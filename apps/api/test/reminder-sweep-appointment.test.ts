import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { runReminderSweep } from '../src/queues/reminder-sweep-worker.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;

/** AppointmentReminder is clinic-scoped — reads must run inside a clinic context. */
function loadReminder(clinicId: string, id: string) {
  return runWithContext({ clinicId }, async () => app.prisma.appointmentReminder.findUniqueOrThrow({ where: { id } }));
}
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/** Insert an appointment + a due PENDING reminder for it, in a clinic context. */
async function seedDueReminder(clinicId: string, doctorId: string, patientId: string, template: string) {
  return runWithContext({ clinicId, userId: doctorId }, async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const appt = await app.prisma.appointment.create({
      data: { clinicId, patientId, doctorId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000), status: 'SCHEDULED', durationMinutes: 30, createdById: doctorId },
    });
    const reminder = await app.prisma.appointmentReminder.create({
      data: { clinicId, appointmentId: appt.id, patientId, scheduledFor: new Date(Date.now() - 60 * 1000), channel: 'whatsapp', template, status: 'PENDING' },
    });
    return { apptId: appt.id, reminderId: reminder.id };
  });
}

describe('Reminder sweep — appointment reminders', () => {
  it('sends a due 24h reminder for a consented patient and marks it SENT', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h', { body: 'Hi {{1}}, appt at {{2}} at {{3}}.', variables: ['n', 'c', 't'] });
    await optIn(app, doc.clinicId, patientId);
    const { reminderId } = await seedDueReminder(doc.clinicId, doc.userId, patientId, 'appointment_reminder_24h');
    const deps = makeSendDeps(app);

    const res = await runReminderSweep({ prisma: app.prisma, send: (input) => sendWhatsAppMessage(deps, input) });
    expect(res.appointmentSent).toBeGreaterThanOrEqual(1);

    const reminder = await loadReminder(doc.clinicId, reminderId);
    expect(reminder.status).toBe('SENT');
    expect(reminder.sentAt).not.toBeNull();

    const msg = await app.prisma.whatsAppMessage.findFirst({ where: { clinicId: doc.clinicId, idempotencyKey: `appt_reminder:${reminderId}` } });
    expect(msg).not.toBeNull();
    expect(msg!.triggerType).toBe('APPOINTMENT_REMINDER_24H');
  });

  it('cancels the reminder (does not perpetually retry) when consent is missing', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_1h', { variables: ['n', 'c'] });
    // No opt-in.
    const { reminderId } = await seedDueReminder(doc.clinicId, doc.userId, patientId, 'appointment_reminder_1h');
    const deps = makeSendDeps(app);

    await runReminderSweep({ prisma: app.prisma, send: (input) => sendWhatsAppMessage(deps, input) });
    const reminder = await loadReminder(doc.clinicId, reminderId);
    expect(reminder.status).toBe('CANCELLED');
    expect(reminder.errorReason).toBe('NOT_ASKED');
  });

  it('does not touch reminders scheduled in the future', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h', { variables: ['n', 'c', 't'] });
    await optIn(app, doc.clinicId, patientId);
    const reminderId = await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, async () => {
      const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const appt = await app.prisma.appointment.create({
        data: { clinicId: doc.clinicId, patientId, doctorId: doc.userId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000), status: 'SCHEDULED', durationMinutes: 30, createdById: doc.userId },
      });
      const r = await app.prisma.appointmentReminder.create({
        data: { clinicId: doc.clinicId, appointmentId: appt.id, patientId, scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), channel: 'whatsapp', template: 'appointment_reminder_24h', status: 'PENDING' },
      });
      return r.id;
    });
    const deps = makeSendDeps(app);
    await runReminderSweep({ prisma: app.prisma, send: (input) => sendWhatsAppMessage(deps, input) });
    const reminder = await loadReminder(doc.clinicId, reminderId);
    expect(reminder.status).toBe('PENDING');
  });
});
