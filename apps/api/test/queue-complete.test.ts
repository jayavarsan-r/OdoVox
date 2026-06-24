import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  findQueueEvent,
  joinReceptionist,
  reloadVisit,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /visits/:id/complete — receptionist checkout', () => {
  it('moves CHECKOUT → COMPLETED and records a Bill + Payment', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'CHECKOUT' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/complete`,
      headers: authHeader(recp.accessToken),
      payload: {
        payment: { method: 'CASH', amountPaise: 350000, reference: 'rcpt-1' },
        prescriptionHanded: true,
        nextVisitConfirmed: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('COMPLETED');

    const reloaded = await reloadVisit(app, doctor.clinicId, visit.id);
    expect(reloaded?.status).toBe('COMPLETED');
    expect(reloaded?.completedAt).toBeTruthy();

    const bill = await app.prisma.bill.findFirst({ where: { visitId: visit.id }, include: { payments: true } });
    expect(bill).toBeTruthy();
    expect(bill?.paidPaise).toBe(350000);
    expect(bill?.status).toBe('PAID');
    expect(bill?.payments).toHaveLength(1);
    expect(bill?.payments[0]?.method).toBe('CASH');

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'COMPLETED' });
    expect(ev).toBeTruthy();
  });

  it('completes with no payment (prescription-only handover)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'CHECKOUT' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/complete`,
      headers: authHeader(recp.accessToken),
      payload: { prescriptionHanded: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('COMPLETED');
    const bill = await app.prisma.bill.findFirst({ where: { visitId: visit.id } });
    expect(bill).toBeNull();
  });
});
