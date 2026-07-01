import type { FastifyInstance } from 'fastify';
import type { PatientWhatsAppConsent } from '@odovox/db';
import { ConsentOptInInput, ConsentOptOutInput, ConsentReconfirmInput } from '@odovox/types';
import { NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin } from '../lib/rbac.js';
import { checkConsent } from '../lib/whatsapp/consent.js';

function serialize(patientId: string, c: PatientWhatsAppConsent | null, canSend: boolean) {
  return {
    id: c?.id ?? null,
    patientId,
    status: c?.status ?? 'NOT_ASKED',
    optedInAt: c?.optedInAt ?? null,
    optedInMethod: c?.optedInMethod ?? null,
    optedOutAt: c?.optedOutAt ?? null,
    optedOutReason: c?.optedOutReason ?? null,
    lastReconfirmedAt: c?.lastReconfirmedAt ?? null,
    notes: c?.notes ?? null,
    canSend,
  };
}

export async function whatsappConsentRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  async function loadPatientOr404(clinicId: string, patientId: string) {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    return patient;
  }

  async function respond(clinicId: string, patientId: string) {
    const consent = await prisma.patientWhatsAppConsent.findUnique({
      where: { clinicId_patientId: { clinicId, patientId } },
    });
    const gate = await checkConsent(prisma, clinicId, patientId);
    return serialize(patientId, consent, gate.canSend);
  }

  // GET consent detail
  fastify.get('/patients/:id/whatsapp-consent', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    await loadPatientOr404(clinicId, id);
    return ok(await respond(clinicId, id));
  });

  // POST opt-in
  fastify.post('/patients/:id/whatsapp-consent/opt-in', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(ConsentOptInInput, req.body);
    await loadPatientOr404(clinicId, id);

    const now = new Date();
    await prisma.patientWhatsAppConsent.upsert({
      where: { clinicId_patientId: { clinicId, patientId: id } },
      update: {
        status: 'OPTED_IN',
        optedInAt: now,
        optedInByUserId: req.user!.id,
        optedInMethod: body.method,
        optedOutAt: null,
        optedOutReason: null,
        notes: body.notes ?? null,
      },
      create: {
        clinicId,
        patientId: id,
        status: 'OPTED_IN',
        optedInAt: now,
        optedInByUserId: req.user!.id,
        optedInMethod: body.method,
        notes: body.notes ?? null,
      },
    });
    await fastify.audit('WHATSAPP_CONSENT_OPTED_IN', 'PatientWhatsAppConsent', id, { method: body.method });
    return ok(await respond(clinicId, id));
  });

  // POST opt-out
  fastify.post('/patients/:id/whatsapp-consent/opt-out', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(ConsentOptOutInput, req.body);
    await loadPatientOr404(clinicId, id);

    const now = new Date();
    await prisma.patientWhatsAppConsent.upsert({
      where: { clinicId_patientId: { clinicId, patientId: id } },
      update: { status: 'OPTED_OUT', optedOutAt: now, optedOutReason: body.reason ?? null },
      create: {
        clinicId,
        patientId: id,
        status: 'OPTED_OUT',
        optedOutAt: now,
        optedOutReason: body.reason ?? null,
      },
    });
    await fastify.audit('WHATSAPP_CONSENT_OPTED_OUT', 'PatientWhatsAppConsent', id, { reason: body.reason });
    return ok(await respond(clinicId, id));
  });

  // POST reconfirm (refresh the 12-month TTL)
  fastify.post('/patients/:id/whatsapp-consent/reconfirm', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(ConsentReconfirmInput, req.body);
    await loadPatientOr404(clinicId, id);

    const now = new Date();
    await prisma.patientWhatsAppConsent.upsert({
      where: { clinicId_patientId: { clinicId, patientId: id } },
      update: { status: 'OPTED_IN', lastReconfirmedAt: now, optedInMethod: body.method, optedOutAt: null, optedOutReason: null },
      create: {
        clinicId,
        patientId: id,
        status: 'OPTED_IN',
        optedInAt: now,
        lastReconfirmedAt: now,
        optedInByUserId: req.user!.id,
        optedInMethod: body.method,
      },
    });
    await fastify.audit('WHATSAPP_CONSENT_RECONFIRMED', 'PatientWhatsAppConsent', id, { method: body.method });
    return ok(await respond(clinicId, id));
  });

  // GET recent consent changes (admin only)
  fastify.get('/whatsapp-consent/audit', adminOnly, async (req) => {
    const clinicId = req.clinicId!;
    const rows = await prisma.auditLog.findMany({
      where: {
        clinicId,
        action: { in: ['WHATSAPP_CONSENT_OPTED_IN', 'WHATSAPP_CONSENT_OPTED_OUT', 'WHATSAPP_CONSENT_RECONFIRMED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        patientId: r.entityId,
        metadata: r.metadata,
        userId: r.userId,
        createdAt: r.createdAt,
      })),
    );
  });
}
