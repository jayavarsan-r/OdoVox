import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { runReminderSweep } from '../src/queues/reminder-sweep-worker.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Reminder sweep — outstanding balance reminders', () => {
  it('sends outstanding_balance_reminder for a due OUTSTANDING BillReminder', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'outstanding_balance_reminder', {
      body: 'Hi {{1}}, balance ₹{{2}} at {{3}}.',
      variables: ['n', 'amt', 'c'],
    });
    await optIn(app, doc.clinicId, patientId);

    const reminderId = await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, async () => {
      await app.prisma.patient.update({ where: { id: patientId }, data: { outstandingPaise: 250000 } });
      const bill = await app.prisma.bill.create({
        data: { clinicId: doc.clinicId, patientId, billNumber: `BL-${Date.now()}`, status: 'FINALIZED', createdById: doc.userId, subtotalPaise: 250000, totalPaise: 250000, balancePaise: 250000 },
      });
      const r = await app.prisma.billReminder.create({
        data: { clinicId: doc.clinicId, billId: bill.id, patientId, type: 'OUTSTANDING', scheduledFor: new Date(Date.now() - 60_000), channel: 'whatsapp', template: 'outstanding_balance_reminder', status: 'PENDING' },
      });
      return r.id;
    });

    const deps = makeSendDeps(app);
    const res = await runReminderSweep({ prisma: app.prisma, send: (input) => sendWhatsAppMessage(deps, input) });
    expect(res.billSent).toBeGreaterThanOrEqual(1);

    const reminder = await app.prisma.billReminder.findUniqueOrThrow({ where: { id: reminderId } });
    expect(reminder.status).toBe('SENT');
    const msg = await app.prisma.whatsAppMessage.findFirst({ where: { clinicId: doc.clinicId, idempotencyKey: `bill_reminder:${reminderId}` } });
    expect(msg).not.toBeNull();
    expect(msg!.body).toContain('2500.00');
  });
});
