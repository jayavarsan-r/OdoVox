import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { runCostAggregation } from '../src/lib/whatsapp/cost.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('WhatsApp cost aggregation', () => {
  it('rolls up this month’s SENT messages into a WhatsAppCostLog split by category', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const utilityId = await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h', { category: 'UTILITY' });
    const serviceId = await seedTemplate(app, doc.clinicId, 'lab_case_ready', { category: 'SERVICE' });

    await runWithContext({ clinicId: doc.clinicId }, async () => {
      await app.prisma.whatsAppMessage.createMany({
        data: [
          { clinicId: doc.clinicId, patientId, direction: 'OUTBOUND', templateId: utilityId, body: 'u1', status: 'SENT', costPaise: 35 },
          { clinicId: doc.clinicId, patientId, direction: 'OUTBOUND', templateId: utilityId, body: 'u2', status: 'DELIVERED', costPaise: 35 },
          { clinicId: doc.clinicId, patientId, direction: 'OUTBOUND', templateId: serviceId, body: 's1', status: 'READ', costPaise: 35 },
          // PENDING + BLOCKED must NOT count toward cost.
          { clinicId: doc.clinicId, patientId, direction: 'OUTBOUND', templateId: utilityId, body: 'p', status: 'PENDING', costPaise: 0 },
          { clinicId: doc.clinicId, patientId, direction: 'OUTBOUND', templateId: utilityId, body: 'b', status: 'BLOCKED_NO_CONSENT', costPaise: 0 },
        ],
      });
    });

    const now = new Date();
    const res = await runCostAggregation(app.prisma, { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
    expect(res.clinics).toBeGreaterThanOrEqual(1);

    const log = await app.prisma.whatsAppCostLog.findUniqueOrThrow({
      where: { clinicId_year_month: { clinicId: doc.clinicId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 } },
    });
    expect(log.conversationsCount).toBe(3);
    expect(log.utilityCount).toBe(2);
    expect(log.serviceCount).toBe(1);
    expect(log.totalCostPaise).toBe(105);
  });
});
