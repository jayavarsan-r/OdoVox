import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, joinReceptionist } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function billFor(clinicGst: { gstApplicable: boolean; gstPercent: number } | null) {
  const s = await createDoctorWithClinic(app);
  const recp = await joinReceptionist(app, s.joinCode);
  const patientId = await createPatient(app, s.clinicId, s.userId);
  if (clinicGst) {
    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      await app.prisma.clinic.update({ where: { id: s.clinicId }, data: clinicGst });
    });
  }
  const created = await app.inject({
    method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
    payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 1000000 }] },
  });
  return created.json().data;
}

describe('Clinic GST handling on bills', () => {
  it('a GST-exempt clinic (default) charges no GST', async () => {
    const bill = await billFor(null);
    expect(bill.gstApplicable).toBe(false);
    expect(bill.gstPaise).toBe(0);
    expect(bill.totalPaise).toBe(1000000);
  });

  it('a GST-registered clinic adds 18% GST to the taxable base', async () => {
    const bill = await billFor({ gstApplicable: true, gstPercent: 18 });
    expect(bill.gstApplicable).toBe(true);
    expect(bill.gstPercent).toBe(18);
    expect(bill.gstPaise).toBe(180000); // 18% of ₹10,000
    expect(bill.totalPaise).toBe(1180000);
  });
});
