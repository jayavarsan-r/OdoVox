import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  ClinicalExtraction,
  MedicineFrequency,
  type ExtractedPrescription,
  type TemplateMedicine,
} from '@odovox/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { storage, isAllowedAudioMime, MAX_AUDIO_BYTES } from '../lib/storage.js';
import { getSttProvider } from '../lib/stt/index.js';
import { getExtractor } from '../lib/ai/index.js';
import { parseAllergies } from '../lib/consultation/context.js';
import { runSafetyChecks, serializeSafetyWarnings } from '../lib/ai/safety.js';

const PresignInput = z.object({ mimeType: z.string().min(1), sizeBytes: z.number().int().positive().optional() });
const TranscribeInput = z.object({ storageKey: z.string().min(1) });
const IntakeInput = z.object({ storageKey: z.string().min(1) });
const RxInput = z.object({ patientId: z.string().min(1), storageKey: z.string().min(1) });

/**
 * Short-clip dictation (search mic, patient intake, prescription). Unlike the consultation pipeline
 * these run INLINE (the user waits in a sheet, audio is ≤30s) — no queue, no SSE. They reuse the
 * same STT/extractor providers + safety layer; no new abstractions. The audio is transient: deleted
 * from S3 right after transcription (no long-term storage, no DB persistence).
 */
export async function dictateRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyClinical = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  /** Reject a storage key that doesn't belong to the caller's clinic (no cross-clinic audio reads). */
  function assertOwnKey(storageKey: string, clinicId: string): void {
    if (!storageKey.startsWith(`clinics/${clinicId}/dictation/`)) {
      throw new ForbiddenError('That audio key does not belong to your clinic');
    }
  }

  /** Download → transcribe → delete (best-effort). Returns the transcript. */
  async function transcribeAndPurge(storageKey: string): Promise<string> {
    const audio = await storage.getObject(storageKey);
    const result = await getSttProvider(fastify.log).transcribe(audio, { language: 'auto', mimeType: 'audio/webm' });
    await storage.deleteObject(storageKey).catch(() => undefined);
    return result.transcript;
  }

  // Shared presign for all dictation surfaces.
  fastify.post('/dictate/presign', anyClinical, async (req) => {
    const body = parse(PresignInput, req.body);
    if (!isAllowedAudioMime(body.mimeType)) throw new ValidationError('Unsupported audio type');
    if (body.sizeBytes && body.sizeBytes > MAX_AUDIO_BYTES) throw new ValidationError('Audio file too large');
    const storageKey = `clinics/${req.clinicId}/dictation/${nanoid()}.webm`;
    const uploadUrl = await storage.presignUpload(storageKey, body.mimeType, 300);
    return ok({ uploadUrl, storageKey });
  });

  // STT-only — the patient-list search mic (transcript → search input, no extraction).
  fastify.post('/dictate/transcribe', anyClinical, async (req) => {
    const { storageKey } = parse(TranscribeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    await fastify.audit('DICTATE_TRANSCRIBE', 'Dictation', null);
    return ok({ transcript });
  });

  // Patient intake — demographics + chief complaint (no clinical safety yet).
  fastify.post('/patients/intake/dictate', doctorOnly, async (req) => {
    const { storageKey } = parse(IntakeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    const intake = await getExtractor(fastify.log).extractPatientIntake(transcript);
    await fastify.audit('DICTATE_INTAKE', 'Dictation', null);
    return ok({ intake, transcript });
  });

  // Walk-in dictation (Phase 9.5 P1.6) — the receptionist speaks a walk-in ("new patient Ramesh
  // Kumar, 98765..., tooth pain") and the walk-in sheet prefills. Same intake extractor as the
  // doctor's new-patient flow, but reception-scoped.
  fastify.post('/queue/walkin/dictate', anyClinical, async (req) => {
    const { storageKey } = parse(IntakeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    const intake = await getExtractor(fastify.log).extractPatientIntake(transcript);
    await fastify.audit('DICTATE_WALKIN', 'Dictation', null);
    return ok({ intake, transcript });
  });

  // Prescription dictation — medicines only, with the allergy/interaction safety check. Phase 5: the
  // doctor can invoke a clinic template by name ("apply RCT pack") — the server populates the
  // template's medicines and merges any explicitly dictated additions.
  fastify.post('/prescriptions/dictate', doctorOnly, async (req) => {
    const { patientId, storageKey } = parse(RxInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');

    // The clinic's active templates, named to the extractor so "apply X" resolves to an id.
    const templates = await prisma.prescriptionTemplate.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, tags: true },
    });

    const transcript = await transcribeAndPurge(storageKey);
    const allergies = parseAllergies(patient.allergiesEnc);
    const prescription = await getExtractor(fastify.log).extractPrescription(transcript, {
      name: patient.name,
      age: patient.age,
      allergies,
      medicalFlags: patient.medicalFlags,
      templates,
    });

    // Resolve a named template: load its medicines, merge (template first, then dictated additions),
    // bump usageCount, and audit TEMPLATE_USED. A stale/cross-clinic id silently no-ops (findFirst is
    // clinic-scoped) so dictation never fails on a bad template reference.
    let templateUsed: { id: string; name: string } | null = null;
    if (prescription.applyTemplateId) {
      const tpl = await prisma.prescriptionTemplate.findFirst({
        where: { id: prescription.applyTemplateId, isArchived: false },
      });
      if (tpl) {
        const tplMeds = (tpl.medicines as TemplateMedicine[]) ?? [];
        prescription.prescriptions = [...tplMeds.map(templateMedicineToExtracted), ...prescription.prescriptions];
        templateUsed = { id: tpl.id, name: tpl.name };
        await prisma.prescriptionTemplate.update({
          where: { id: tpl.id },
          data: { usageCount: { increment: 1 } },
        });
        await fastify.audit('TEMPLATE_USED', 'PrescriptionTemplate', tpl.id, { via: 'dictation' });
      }
    }

    // Reuse the clinical safety layer over the FINAL merged medicines.
    const safety = runSafetyChecks(
      ClinicalExtraction.parse({ prescriptions: prescription.prescriptions }),
      { age: patient.age, medicalFlags: patient.medicalFlags },
      allergies,
    );
    await fastify.audit('DICTATE_PRESCRIPTION', 'Dictation', patient.id);
    return ok({
      prescription,
      templateUsed,
      safetyWarnings: serializeSafetyWarnings(safety),
      safety: { warnings: safety.warnings, blockingErrors: safety.blockingErrors },
    });
  });
}

/** Coerce a template medicine (free-string frequency) into the dictation medicine shape. */
function templateMedicineToExtracted(m: TemplateMedicine): ExtractedPrescription {
  const freq = MedicineFrequency.safeParse(m.frequency);
  return {
    name: m.name,
    dosage: m.dosage ?? null,
    frequency: freq.success ? freq.data : null,
    durationDays: m.durationDays ?? null,
    instructions: m.instructions ?? null,
  };
}
