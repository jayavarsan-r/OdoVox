import type { ClinicalExtractionContext } from '@odovox/types';
import { decryptField } from '../lib/encryption.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { runAsSystem } from '../lib/request-context.js';
import { runSafetyChecks, serializeSafetyWarnings } from '../lib/ai/safety.js';
import { parseAllergies } from '../lib/consultation/context.js';
import type { IClinicalExtractor } from '../lib/ai/index.js';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';
import type { ConsultationEvent } from './events.js';
import type { ExtractionKind, WorkerLogger } from './stt-worker.js';
import { writeWorkerAudit } from './worker-audit.js';

/**
 * Extraction worker — decrypts the transcript, builds the patient context, runs the extractor, then
 * the safety layer, and stores the structured result (status stays PENDING_REVIEW; the doctor's
 * verification card is the only gate to a DB commit). Standalone-runnable; pure processor injected.
 */
export interface ExtractionDeps {
  prisma: ExtendedPrismaClient;
  extractor: IClinicalExtractor;
  emit: (consultationId: string, event: ConsultationEvent) => void | Promise<void>;
  logger?: WorkerLogger;
  /** Phase 4 cross-wire: pipeline settled (READY/FAILED) — clears the "recording" indicator. */
  onPipelineSettled?: (info: { clinicId: string; visitId: string; doctorId: string }) => void | Promise<void>;
}

export interface ExtractionJobData {
  consultationId: string;
  jobId: string;
  kind: ExtractionKind;
}

export async function runExtractionJob(deps: ExtractionDeps, data: ExtractionJobData): Promise<void> {
  const { prisma } = deps;

  await runAsSystem(async () => {
    const consult = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
      include: { visit: { include: { patient: true } } },
    });
    if (!consult) throw new NotFoundError('Consultation not found');
    if (!consult.rawTranscriptEnc) throw new AppError('No transcript to extract', 422, 'NO_TRANSCRIPT');
    const clinicId = consult.visit.clinicId;
    const patient = consult.visit.patient;

    await prisma.job.update({
      where: { id: data.jobId },
      data: { status: 'RUNNING', attempts: { increment: 1 } },
    });
    await writeWorkerAudit(prisma, clinicId, 'EXTRACTION_STARTED', consult.id, { kind: data.kind });
    await deps.emit(consult.id, { type: 'EXTRACTING' });

    const startedAt = Date.now();
    try {
      const transcript = decryptField(consult.rawTranscriptEnc);
      const allergies = parseAllergies(patient.allergiesEnc);

      const ctx: ClinicalExtractionContext = {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        allergies,
        medicalFlags: patient.medicalFlags,
        currentPlanSummary: null,
        lastVisitSummary: null,
        chiefComplaint: patient.chiefComplaint,
      };

      const extracted = await deps.extractor.extractClinical(transcript, ctx);

      // Safety layer runs after extraction, before the verification card.
      const safety = runSafetyChecks(
        extracted,
        { age: patient.age, medicalFlags: patient.medicalFlags },
        allergies,
      );
      const warningCodes = serializeSafetyWarnings(safety);
      extracted.safetyWarnings = warningCodes;

      // Persist the rich safety (messages + blocking errors) alongside the extraction so the
      // verification card can render warnings and gate Confirm on blocking errors. confirm()
      // re-parses ClinicalExtraction and ignores the extra `safety` key.
      const structuredData = {
        ...extracted,
        safety: { warnings: safety.warnings, blockingErrors: safety.blockingErrors },
      };
      const extractionLatencyMs = Date.now() - startedAt;

      await prisma.consultation.update({
        where: { id: consult.id },
        data: {
          structuredData: structuredData as object,
          safetyWarnings: warningCodes,
          extractionLatencyMs,
          provider: `${process.env.STT_PROVIDER ?? 'mock'}+${process.env.AI_PROVIDER ?? 'mock'}`,
          status: 'PENDING_REVIEW',
        },
      });
      await prisma.job.update({
        where: { id: data.jobId },
        data: { status: 'SUCCEEDED', durationMs: extractionLatencyMs, completedAt: new Date() },
      });
      await writeWorkerAudit(prisma, clinicId, 'EXTRACTION_COMPLETED', consult.id, {
        ms: extractionLatencyMs,
        warnings: warningCodes,
        blocking: safety.blockingErrors.length,
      });
      await deps.emit(consult.id, { type: 'READY', data: { structuredData } });
      await deps.onPipelineSettled?.({ clinicId, visitId: consult.visitId, doctorId: consult.visit.doctorId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.logger?.error({ err, consultationId: consult.id }, 'Extraction job failed');
      await prisma.job.update({
        where: { id: data.jobId },
        data: { status: 'FAILED', lastError: message, completedAt: new Date() },
      });
      await writeWorkerAudit(prisma, clinicId, 'EXTRACTION_FAILED', consult.id, { error: message });
      await deps.emit(consult.id, { type: 'FAILED', data: { stage: 'extraction', message } });
      await deps.onPipelineSettled?.({ clinicId, visitId: consult.visitId, doctorId: consult.visit.doctorId });
      throw err;
    }
  });
}
