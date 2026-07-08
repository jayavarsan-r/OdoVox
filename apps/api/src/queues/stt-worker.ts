import { encryptField } from '../lib/encryption.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { runAsSystem } from '../lib/request-context.js';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';
import type { ISttProvider } from '../lib/stt/index.js';
import type { ConsultationEvent } from './events.js';
import { writeWorkerAudit } from './worker-audit.js';

/**
 * STT worker — standalone-runnable (no Fastify request-context dependency). It transcribes the
 * uploaded audio, encrypts the transcript at rest, records telemetry, and enqueues extraction.
 * `runSttJob` is the pure processor (injected deps → testable); `createSttWorker` wraps it in a
 * BullMQ Worker (see queues/index.ts).
 */

export interface WorkerLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export type ExtractionKind = 'CLINICAL' | 'PRESCRIPTION' | 'INTAKE';

export interface SttDeps {
  prisma: ExtendedPrismaClient;
  stt: ISttProvider;
  loadAudio: (storageKey: string) => Promise<Buffer>;
  emit: (consultationId: string, event: ConsultationEvent) => void | Promise<void>;
  enqueueExtraction: (data: { consultationId: string; kind: ExtractionKind }) => Promise<void>;
  logger?: WorkerLogger;
}

export interface SttJobData {
  consultationId: string;
  jobId: string;
}

export async function runSttJob(deps: SttDeps, data: SttJobData): Promise<void> {
  const { prisma } = deps;

  await runAsSystem(async () => {
    const consult = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
      include: { visit: true },
    });
    if (!consult) throw new NotFoundError('Consultation not found');
    if (!consult.audioStorageKey) throw new AppError('No audio to transcribe', 422, 'NO_AUDIO');
    const clinicId = consult.visit.clinicId;

    await prisma.job.update({
      where: { id: data.jobId },
      data: { status: 'RUNNING', attempts: { increment: 1 } },
    });
    await writeWorkerAudit(prisma, clinicId, 'STT_STARTED', consult.id);
    await deps.emit(consult.id, { type: 'TRANSCRIBING' });

    const startedAt = Date.now();
    try {
      const audio = await deps.loadAudio(consult.audioStorageKey);
      // STT_LANGUAGE pins the clinic's dictation language (e.g. ta-IN) — Sarvam's auto-detect
      // garbles Tamil dental terms far more than the explicit hint (Phase 9.6 Issue 8).
      const language = (['en-IN', 'hi-IN', 'ta-IN'] as const).find((l) => l === process.env.STT_LANGUAGE) ?? 'auto';
      const result = await deps.stt.transcribe(audio, { language, mimeType: 'audio/webm' });
      const sttLatencyMs = Date.now() - startedAt;

      await prisma.consultation.update({
        where: { id: consult.id },
        data: {
          rawTranscriptEnc: encryptField(result.transcript),
          languageCode: result.languageCode,
          audioDurationMs: result.durationMs,
          sttLatencyMs,
          provider: process.env.STT_PROVIDER ?? 'mock',
        },
      });
      await prisma.job.update({
        where: { id: data.jobId },
        data: { status: 'SUCCEEDED', durationMs: sttLatencyMs, completedAt: new Date() },
      });
      await writeWorkerAudit(prisma, clinicId, 'STT_COMPLETED', consult.id, {
        ms: sttLatencyMs,
        languageCode: result.languageCode,
      });
      await deps.emit(consult.id, { type: 'TRANSCRIBED', data: { transcript: result.transcript } });
      await deps.enqueueExtraction({ consultationId: consult.id, kind: 'CLINICAL' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.logger?.error({ err, consultationId: consult.id }, 'STT job failed');
      await prisma.job.update({
        where: { id: data.jobId },
        data: { status: 'FAILED', lastError: message, completedAt: new Date() },
      });
      await writeWorkerAudit(prisma, clinicId, 'STT_FAILED', consult.id, { error: message });
      await deps.emit(consult.id, { type: 'FAILED', data: { stage: 'stt', message } });
      throw err;
    }
  });
}
