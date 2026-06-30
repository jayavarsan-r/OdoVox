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

describe('Lab charge is not double-billed', () => {
  it('a lab case billed on one bill is excluded from a later bill for the same visit', async () => {
    const s = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, s.joinCode);
    const patientId = await createPatient(app, s.clinicId, s.userId);
    const visit = await createVisit(app, s.clinicId, { patientId, doctorId: s.userId, status: 'CHECKOUT' });

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const vendor = await app.prisma.labVendor.create({
        data: { clinicId: s.clinicId, name: 'Lab', contactPhoneEnc: 'enc', specialties: [], createdById: s.userId },
      });
      await app.prisma.labCase.create({
        data: {
          clinicId: s.clinicId, patientId, doctorId: s.userId, vendorId: vendor.id, caseNumber: 'LC-DBL1',
          type: 'CROWN', teeth: [26], visitId: visit.id, patientChargePaise: 600000, status: 'READY', createdById: s.userId,
        },
      });
    });

    const first = await app.inject({ method: 'POST', url: '/bills', headers: authHeader(recp.accessToken), payload: { patientId, visitId: visit.id } });
    expect(first.json().data.items.filter((i: { kind: string }) => i.kind === 'LAB_CHARGE')).toHaveLength(1);

    // A second bill from the same visit must NOT re-include the already-billed lab charge.
    const second = await app.inject({ method: 'POST', url: '/bills', headers: authHeader(recp.accessToken), payload: { patientId, visitId: visit.id } });
    expect(second.json().data.items.filter((i: { kind: string }) => i.kind === 'LAB_CHARGE')).toHaveLength(0);
  });
});
