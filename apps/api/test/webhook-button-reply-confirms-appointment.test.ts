import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { patientPhone, postWhatsAppWebhook } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const rid = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

async function seedUpcomingAppt(clinicId: string, doctorId: string, patientId: string) {
  return runWithContext({ clinicId, userId: doctorId }, async () => {
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appt = await app.prisma.appointment.create({
      data: { clinicId, patientId, doctorId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000), status: 'SCHEDULED', durationMinutes: 30, createdById: doctorId },
    });
    return appt.id;
  });
}

describe('WhatsApp button reply', () => {
  it('button "1" confirms the upcoming appointment and audits it', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const phone = await patientPhone(app, doc.clinicId, patientId);
    const apptId = await seedUpcomingAppt(doc.clinicId, doc.userId, patientId);

    await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/incoming',
      { messages: [{ from: `+91${phone}`, type: 'interactive', id: 'wamid.b1', interactive: { button_reply: { id: '1', title: 'Confirm' } } }] },
      { eventId: rid() },
    );

    const audit = await app.prisma.auditLog.findFirst({
      where: { clinicId: doc.clinicId, action: 'APPOINTMENT_CONFIRMED_VIA_WHATSAPP', entityId: apptId },
    });
    expect(audit).not.toBeNull();
  });

  it('button "2" marks the conversation as a reschedule request', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const phone = await patientPhone(app, doc.clinicId, patientId);
    await seedUpcomingAppt(doc.clinicId, doc.userId, patientId);

    await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/incoming',
      { messages: [{ from: `+91${phone}`, type: 'interactive', id: 'wamid.b2', interactive: { button_reply: { id: '2', title: 'Reschedule' } } }] },
      { eventId: rid() },
    );

    const convo = await app.prisma.patientConversation.findUniqueOrThrow({
      where: { clinicId_patientId: { clinicId: doc.clinicId, patientId } },
    });
    expect(convo.category).toBe('RESCHEDULE_REQUEST');
  });
});
