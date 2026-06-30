import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader, buildTestApp, createDoctorWithClinic, createPatient, createVisit, joinReceptionist,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Lab charge flows to the bill', () => {
  it('includes the lab charge and marks the case billed', async () => {
    const s = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, s.joinCode);
    const patientId = await createPatient(app, s.clinicId, s.userId);
    const visit = await createVisit(app, s.clinicId, { patientId, doctorId: s.userId, status: 'CHECKOUT' });

    const caseId = await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const vendor = await app.prisma.labVendor.create({
        data: { clinicId: s.clinicId, name: 'Lab', contactPhoneEnc: 'enc', specialties: [], createdById: s.userId },
      });
      const lc = await app.prisma.labCase.create({
        data: {
          clinicId: s.clinicId, patientId, doctorId: s.userId, vendorId: vendor.id, caseNumber: 'LC-FLOW1',
          type: 'BRIDGE', teeth: [24, 25, 26], material: 'PFM', visitId: visit.id, patientChargePaise: 800000,
          status: 'READY', createdById: s.userId,
        },
      });
      return lc.id;
    });

    const res = await app.inject({ method: 'POST', url: '/bills', headers: authHeader(recp.accessToken), payload: { patientId, visitId: visit.id } });
    const billId = res.json().data.id;
    const lab = res.json().data.items.find((i: { kind: string }) => i.kind === 'LAB_CHARGE');
    expect(lab.unitPricePaise).toBe(800000);

    const billed = await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () =>
      app.prisma.labCase.findUniqueOrThrow({ where: { id: caseId } }),
    );
    expect(billed.billedInBillId).toBe(billId);
  });
});
