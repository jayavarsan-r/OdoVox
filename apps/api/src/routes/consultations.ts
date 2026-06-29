import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ClinicalExtraction } from '@odovox/types';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { storage, isAllowedAudioMime, MAX_AUDIO_BYTES } from '../lib/storage.js';
import { toConsultationResponse } from '../lib/serialize.js';
import { commitConsultation } from '../lib/consultation/commit.js';
import { parseAllergies } from '../lib/consultation/context.js';
import { runSafetyChecks } from '../lib/ai/safety.js';
import { enqueueSttJob, enqueueExtractionJob } from '../queues/index.js';
import {
  consultationChannel,
  getConsultationEventsSince,
  publishConsultationEvent,
} from '../queues/events.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { markRecording } from '../lib/realtime/recording.js';
import { loadQueueVisit } from '../lib/queue/snapshot.js';
import { APPOINTMENT_INCLUDE, serializeAppointment } from '../lib/schedule/serialize.js';

const StartInput = z.object({ patientId: z.string().min(1), visitId: z.string().min(1).optional() });
const PresignInput = z.object({
  consultationId: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
});
const ConfirmInput = z.object({ structuredData: z.unknown(), confirmedWithWarning: z.boolean().optional() });
const RejectInput = z.object({ reason: z.string().max(500).optional() });
const PatchInput = z.object({ structuredData: z.unknown() });

export async function consultationRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyClinical = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  /** Load a consultation (+ visit + patient), enforcing it belongs to the caller's clinic. */
  async function loadInClinic(id: string, clinicId: string) {
    const consult = await prisma.consultation.findUnique({
      where: { id },
      include: { visit: { include: { patient: true } } },
    });
    if (!consult || consult.deletedAt || consult.visit.clinicId !== clinicId) {
      throw new NotFoundError('Consultation not found');
    }
    return consult;
  }

  // POST /consultations — start a consultation for a patient (creates a visit if none given).
  fastify.post('/consultations', doctorOnly, async (req) => {
    const body = parse(StartInput, req.body);
    const patient = await prisma.patient.findFirst({ where: { id: body.patientId, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');

    let visitId = body.visitId;
    if (visitId) {
      const v = await prisma.visit.findFirst({ where: { id: visitId } });
      if (!v || v.patientId !== body.patientId) throw new NotFoundError('Visit not found');
    } else {
      const count = await prisma.visit.count({});
      const visit = await prisma.visit.create({
        data: { clinicId: req.clinicId!, patientId: body.patientId, doctorId: req.user!.id, status: 'IN_CHAIR', tokenNumber: count + 1 },
      });
      visitId = visit.id;
    }

    const consult =
      (await prisma.consultation.findUnique({ where: { visitId } })) ??
      (await prisma.consultation.create({ data: { visitId, status: 'PENDING_REVIEW', structuredData: {} } }));
    await fastify.audit('CONSULTATION_STARTED', 'Consultation', consult.id, { patientId: body.patientId });
    return ok({ consultationId: consult.id, visitId });
  });

  // POST /consultations/audio/presign — signed PUT for a direct browser→S3 upload.
  fastify.post('/consultations/audio/presign', doctorOnly, async (req) => {
    const body = parse(PresignInput, req.body);
    if (!isAllowedAudioMime(body.mimeType)) throw new ValidationError('Unsupported audio type');
    if (body.sizeBytes && body.sizeBytes > MAX_AUDIO_BYTES) throw new ValidationError('Audio file too large');
    const consult = await loadInClinic(body.consultationId, req.clinicId!);
    const storageKey = `clinics/${req.clinicId}/audio/${consult.id}.webm`;
    const uploadUrl = await storage.presignUpload(storageKey, body.mimeType, 300);
    await prisma.consultation.update({ where: { id: consult.id }, data: { audioStorageKey: storageKey } });
    await fastify.audit('CONSULTATION_AUDIO_PRESIGNED', 'Consultation', consult.id);
    return ok({ uploadUrl, storageKey, consultationId: consult.id });
  });

  // POST /consultations/:id/process — enqueue STT (+ extraction chained by the worker).
  fastify.post('/consultations/:id/process', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const consult = await loadInClinic(id, req.clinicId!);
    if (!consult.audioStorageKey) throw new ValidationError('No audio uploaded yet');
    const job = await prisma.job.create({
      data: { clinicId: consult.visit.clinicId, kind: 'STT', status: 'QUEUED', inputRef: consult.id },
    });
    await enqueueSttJob({ consultationId: consult.id, jobId: job.id });
    await publishConsultationEvent(fastify.redis, consult.id, { type: 'RECORDED' });
    await fastify.audit('CONSULTATION_PROCESS_ENQUEUED', 'Consultation', consult.id, { jobId: job.id });

    // Phase 4 cross-wire: light the "Dr. X is recording" indicator on the clinic's screens. The
    // matching `doctor.recording.stopped` fires from the extraction worker when the pipeline settles.
    await markRecording(fastify.redis, consult.visit.clinicId, consult.visitId);
    broadcastToClinic(consult.visit.clinicId, {
      type: 'doctor.recording.started',
      payload: { visitId: consult.visitId, doctorId: req.user!.id, patientName: consult.visit.patient.name },
    });
    return ok({ jobId: job.id });
  });

  // GET /consultations/:id — status + structured data + patient/visit/x-ray context. Transcript
  // only for doctor/admin. The context (Phase 4.5) lets the consult page show the chief complaint
  // the receptionist checked the patient in for, plus any x-rays they attached at check-in.
  fastify.get('/consultations/:id', anyClinical, async (req) => {
    const { id } = req.params as { id: string };
    const consult = await loadInClinic(id, req.clinicId!);
    const latestJob = await prisma.job.findFirst({ where: { inputRef: id }, orderBy: { createdAt: 'desc' } });
    const includeTranscript = req.role === 'DOCTOR' || req.role === 'ADMIN';

    // Media is clinic-scoped, and loadInClinic already proved the visit is in the caller's clinic —
    // so this can't surface another clinic's x-rays.
    const xrays = await prisma.media.findMany({
      where: { visitId: consult.visitId, type: 'XRAY', deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
      select: { id: true, type: true, mimeType: true },
    });
    const p = consult.visit.patient;
    const context = {
      patient: {
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        patientCode: p.patientCode,
        allergies: parseAllergies(p.allergiesEnc),
        medicalFlags: p.medicalFlags,
      },
      visit: {
        id: consult.visit.id,
        tokenNumber: consult.visit.tokenNumber,
        chiefComplaint: consult.visit.chiefComplaint ?? p.chiefComplaint ?? null,
        calledInAt: consult.visit.calledInAt ?? null,
        status: consult.visit.status,
      },
      xrays,
    };

    return ok({
      ...toConsultationResponse(consult, { includeTranscript }),
      latestJob: latestJob ? { kind: latestJob.kind, status: latestJob.status, lastError: latestJob.lastError } : null,
      context,
    });
  });

  // GET /consultations/:id/stream — SSE live pipeline updates (doctor only; transcript leaks otherwise).
  fastify.get('/consultations/:id/stream', doctorOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    await loadInClinic(id, req.clinicId!);
    const since = Number((req.query as { since?: string }).since ?? 0) || 0;

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // never let Nginx buffer an SSE stream
    });
    raw.write('retry: 3000\n\n');

    const send = (eid: number, type: string, payload: unknown) => {
      raw.write(`id: ${eid}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    // Replay anything missed since the client's Last-Event-ID, then go live.
    for (const { id: eid, event } of await getConsultationEventsSince(fastify.redis, id, since)) {
      send(eid, event.type, event);
    }

    const sub = fastify.redis.duplicate();
    await sub.subscribe(consultationChannel(id));
    sub.on('message', (_chan, message) => {
      try {
        const { id: eid, event } = JSON.parse(message) as { id: number; event: { type: string } };
        send(eid, event.type, event);
      } catch {
        /* ignore malformed */
      }
    });

    // Heartbeat: keeps mobile/flaky connections alive (they drop a silent stream after ~30s).
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), 15_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      void sub.unsubscribe().catch(() => undefined).then(() => sub.quit());
      raw.end();
    });
  });

  // POST /consultations/:id/confirm — the gate. Single-transaction commit (see commit.ts).
  fastify.post('/consultations/:id/confirm', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ConfirmInput, req.body);
    const consult = await loadInClinic(id, req.clinicId!);
    const patient = consult.visit.patient;
    const data = ClinicalExtraction.parse(body.structuredData);

    // Re-run safety on the FINAL edited data — blocking errors (e.g. invalid tooth) gate Confirm.
    const safety = runSafetyChecks(
      data,
      { age: patient.age, medicalFlags: patient.medicalFlags },
      parseAllergies(patient.allergiesEnc),
    );
    if (safety.blockingErrors.length > 0) {
      throw new AppError('Resolve blocking errors before confirming', 422, 'BLOCKING_ERRORS', {
        blockingErrors: safety.blockingErrors,
      });
    }

    const result = await commitConsultation(prisma, {
      consultationId: id,
      structuredData: data,
      userId: req.user!.id,
      confirmedWithWarning: body.confirmedWithWarning ?? false,
    });
    // PDF generation stays lazy (GET /prescriptions/:id/pdf) — no enqueue here, so no orphan-job
    // risk, and the confirm never blocks on or fails because of PDF work.

    // Phase 4 cross-wire (§3.3): the commit moved Visit → CHECKOUT. Broadcast it AFTER the
    // transaction so the receptionist's "Ready for Checkout" section updates instantly.
    const qVisit = await loadQueueVisit(prisma, req.clinicId!, consult.visitId);
    if (qVisit) broadcastToClinic(req.clinicId!, { type: 'queue.visit.checkout', payload: qVisit });

    // Phase 6 (§5): a follow-up that auto-scheduled an appointment broadcasts to the calendar.
    if (result.appointmentId) {
      const appt = await prisma.appointment.findFirst({
        where: { id: result.appointmentId, clinicId: req.clinicId! },
        include: APPOINTMENT_INCLUDE,
      });
      if (appt) {
        broadcastToClinic(req.clinicId!, {
          type: 'schedule.appointment.created',
          payload: serializeAppointment(appt),
        });
      }
    }
    return ok(result);
  });

  // POST /consultations/:id/reject — keep for audit, never surfaces in the timeline.
  fastify.post('/consultations/:id/reject', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(RejectInput, req.body);
    const consult = await loadInClinic(id, req.clinicId!);
    if (consult.status === 'CONFIRMED') throw new AppError('Consultation already confirmed', 409, 'ALREADY_CONFIRMED');
    await prisma.consultation.update({
      where: { id },
      data: { status: 'REJECTED', rejectedById: req.user!.id, rejectedReason: body.reason ?? null },
    });
    await fastify.audit('CONSULTATION_REJECTED', 'Consultation', id, { reason: body.reason ?? null });
    return ok({ id, status: 'REJECTED' });
  });

  // POST /consultations/:id/retranscribe — re-run STT (e.g. wrong language detected).
  fastify.post('/consultations/:id/retranscribe', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const consult = await loadInClinic(id, req.clinicId!);
    if (!consult.audioStorageKey) throw new ValidationError('No audio to re-transcribe');
    const job = await prisma.job.create({
      data: { clinicId: consult.visit.clinicId, kind: 'STT', status: 'QUEUED', inputRef: id },
    });
    await enqueueSttJob({ consultationId: id, jobId: job.id });
    await fastify.audit('CONSULTATION_RETRANSCRIBE', 'Consultation', id, { jobId: job.id });
    return ok({ jobId: job.id });
  });

  // POST /consultations/:id/reextract — re-run Gemini against the existing transcript.
  fastify.post('/consultations/:id/reextract', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const consult = await loadInClinic(id, req.clinicId!);
    if (!consult.rawTranscriptEnc) throw new ValidationError('No transcript to re-extract');
    const job = await prisma.job.create({
      data: { clinicId: consult.visit.clinicId, kind: 'EXTRACTION_CLINICAL', status: 'QUEUED', inputRef: id },
    });
    await enqueueExtractionJob({ consultationId: id, jobId: job.id, kind: 'CLINICAL' });
    await fastify.audit('CONSULTATION_REEXTRACT', 'Consultation', id, { jobId: job.id });
    return ok({ jobId: job.id });
  });

  // PATCH /consultations/:id — per-field edits on the verification card (no DB commit yet).
  fastify.patch('/consultations/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(PatchInput, req.body);
    await loadInClinic(id, req.clinicId!);
    const data = ClinicalExtraction.parse(body.structuredData);
    await prisma.consultation.update({
      where: { id },
      data: { structuredData: data as object, safetyWarnings: data.safetyWarnings },
    });
    return ok({ id });
  });
}
