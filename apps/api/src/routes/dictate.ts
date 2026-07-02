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
import { requireAdmin, requireRole } from '../lib/rbac.js';
import { storage, isAllowedAudioMime, MAX_AUDIO_BYTES } from '../lib/storage.js';
import { getSttProvider } from '../lib/stt/index.js';
import { getExtractor } from '../lib/ai/index.js';
import { extractFromTranscript } from '../lib/ai/extractors/index.js';
import { inventoryPurchaseExtractor } from '../lib/ai/extractors/inventory-purchase.js';
import { inventoryConsumeExtractor } from '../lib/ai/extractors/inventory-consume.js';
import { inventoryAdjustExtractor } from '../lib/ai/extractors/inventory-adjust.js';
import { billItemsExtractor } from '../lib/ai/extractors/bill-items.js';
import { fuzzyMatchInventoryItem, type CatalogItem } from '../lib/inventory/fuzzy.js';
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
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  /** The clinic's live item catalog — extractor spelling hints + server-side fuzzy matching. */
  async function loadCatalog(clinicId: string): Promise<CatalogItem[]> {
    const rows = await prisma.inventoryItem.findMany({
      where: { clinicId, isArchived: false },
      select: { id: true, name: true, unitOfMeasure: true, currentStock: true },
    });
    return rows;
  }

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

  // ==========================================================================
  // Phase 9.7 W1.2 — voice everywhere. Each endpoint: transcribe → shared
  // extractor runner → server-side enrichment (fuzzy matches) → the client's
  // verification card applies via the existing mutation endpoints.
  // ==========================================================================

  // Inventory purchase (W1.2.1) — matched items apply via /inventory/items/:id/purchase;
  // unmatched surface as "New item — will create?" on the verification card.
  fastify.post('/inventory/dictate/purchase', anyClinical, async (req) => {
    const { storageKey } = parse(TranscribeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const catalog = await loadCatalog(req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    const extraction = await extractFromTranscript(
      inventoryPurchaseExtractor,
      transcript,
      { knownItemNames: catalog.map((c) => c.name) },
      fastify.log,
    );
    const items = extraction.items.map((it) => ({ ...it, match: fuzzyMatchInventoryItem(it.name, catalog) }));
    await fastify.audit('DICTATE_INVENTORY_PURCHASE', 'Dictation', null, { items: items.length });
    return ok({ extraction: { ...extraction, items }, transcript });
  });

  // Inventory consumption (W1.2.2) — "used 5 gloves and 2 carpules for this filling".
  // Stock never goes below zero: the apply path (/inventory/items/:id/consume) 422s.
  fastify.post('/inventory/dictate/consume', doctorOnly, async (req) => {
    const { storageKey } = parse(TranscribeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const catalog = await loadCatalog(req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    const extraction = await extractFromTranscript(
      inventoryConsumeExtractor,
      transcript,
      { knownItemNames: catalog.map((c) => c.name) },
      fastify.log,
    );
    const items = extraction.items.map((it) => {
      const match = fuzzyMatchInventoryItem(it.name, catalog);
      return { ...it, match, insufficientStock: match !== null && match.currentStock < it.quantity };
    });
    await fastify.audit('DICTATE_INVENTORY_CONSUME', 'Dictation', null, { items: items.length });
    return ok({ extraction: { ...extraction, items }, transcript });
  });

  // Inventory stock-count adjustment (W1.2.3) — ADMIN only, absolute newCount per item.
  fastify.post('/inventory/dictate/adjust', adminOnly, async (req) => {
    const { storageKey } = parse(TranscribeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const catalog = await loadCatalog(req.clinicId!);
    const transcript = await transcribeAndPurge(storageKey);
    const extraction = await extractFromTranscript(
      inventoryAdjustExtractor,
      transcript,
      { knownItemNames: catalog.map((c) => c.name) },
      fastify.log,
    );
    const items = extraction.items.map((it) => ({ ...it, match: fuzzyMatchInventoryItem(it.name, catalog) }));
    await fastify.audit('DICTATE_INVENTORY_ADJUST', 'Dictation', null, { items: items.length });
    return ok({ extraction: { ...extraction, items }, transcript });
  });

  // Bill line items (W1.2.6) — extraction only; the card applies via POST /bills/:id/items
  // (DRAFT-gating and totals recompute live there).
  fastify.post('/bills/:id/dictate/items', anyClinical, async (req) => {
    const { id } = req.params as { id: string };
    const { storageKey } = parse(TranscribeInput, req.body);
    assertOwnKey(storageKey, req.clinicId!);
    const bill = await prisma.bill.findFirst({
      where: { id, clinicId: req.clinicId! },
      include: { patient: { select: { name: true } } },
    });
    if (!bill) throw new NotFoundError('Bill not found');
    const transcript = await transcribeAndPurge(storageKey);
    const extraction = await extractFromTranscript(
      billItemsExtractor,
      transcript,
      { patientName: bill.patient.name },
      fastify.log,
    );
    await fastify.audit('DICTATE_BILL_ITEMS', 'Bill', id, { items: extraction.items.length });
    return ok({ extraction, transcript });
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
