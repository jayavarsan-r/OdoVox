import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinReceptionist,
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

async function setup() {
  const doctor = await createDoctorWithClinic(app);
  const recp = await joinReceptionist(app, doctor.joinCode);
  const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
  const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'CHECKOUT' });
  return { doctor, recp, patientId, visitId: visit.id };
}

const createBillFromVisit = (token: string, patientId: string, visitId: string) =>
  app.inject({ method: 'POST', url: '/bills', headers: authHeader(token), payload: { patientId, visitId } });

describe('Bill auto-population from a visit', () => {
  it('adds a PROCEDURE item for each procedure with a sitting in the visit', async () => {
    const { doctor, recp, patientId, visitId } = await setup();
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      const plan = await app.prisma.treatmentPlan.create({
        data: { patientId, name: 'RCT', status: 'ACTIVE', createdById: doctor.userId },
      });
      const proc = await app.prisma.procedure.create({
        data: { planId: plan.id, name: 'RCT', toothNumbers: [26], totalSittings: 4 },
      });
      await app.prisma.sitting.create({ data: { procedureId: proc.id, visitId, sittingNumber: 3, completedAt: new Date() } });
    });
    const res = await createBillFromVisit(recp.accessToken, patientId, visitId);
    expect(res.statusCode).toBe(201);
    const items = res.json().data.items;
    const proc = items.find((i: { kind: string }) => i.kind === 'PROCEDURE');
    expect(proc).toBeTruthy();
    expect(proc.description).toContain('RCT');
    expect(proc.description).toContain('sitting 3');
    expect(proc.sourceType).toBe('procedure');
  });

  it('adds a LAB_CHARGE item for a linked lab case with a patient charge', async () => {
    const { doctor, recp, patientId, visitId } = await setup();
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      const vendor = await app.prisma.labVendor.create({
        data: { clinicId: doctor.clinicId, name: 'Acme Lab', contactPhoneEnc: 'enc', specialties: [], createdById: doctor.userId },
      });
      await app.prisma.labCase.create({
        data: {
          clinicId: doctor.clinicId, patientId, doctorId: doctor.userId, vendorId: vendor.id,
          caseNumber: 'LC-AUTO1', type: 'CROWN', teeth: [26], material: 'Zirconia',
          visitId, patientChargePaise: 600000, status: 'READY', createdById: doctor.userId,
        },
      });
    });
    const res = await createBillFromVisit(recp.accessToken, patientId, visitId);
    const lab = res.json().data.items.find((i: { kind: string }) => i.kind === 'LAB_CHARGE');
    expect(lab).toBeTruthy();
    expect(lab.unitPricePaise).toBe(600000);
    expect(lab.sourceType).toBe('lab_case');
  });

  it('adds MATERIAL items only when the clinic charges for materials', async () => {
    const { doctor, recp, patientId, visitId } = await setup();
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      const cat = await app.prisma.inventoryCategory.create({
        data: { clinicId: doctor.clinicId, name: 'Consumables', createdById: doctor.userId },
      });
      const item = await app.prisma.inventoryItem.create({
        data: {
          clinicId: doctor.clinicId, categoryId: cat.id, name: 'Gloves', unitOfMeasure: 'box',
          currentStock: 10, lastPurchasePricePaise: 20000, createdById: doctor.userId,
        },
      });
      await app.prisma.inventoryMovement.create({
        data: { clinicId: doctor.clinicId, itemId: item.id, kind: 'CONSUMPTION', quantity: -2, visitId, byUserId: doctor.userId },
      });
    });

    // chargeForMaterials defaults false → no MATERIAL item.
    const without = await createBillFromVisit(recp.accessToken, patientId, visitId);
    expect(without.json().data.items.some((i: { kind: string }) => i.kind === 'MATERIAL')).toBe(false);

    // Opt in → MATERIAL item appears on the next bill.
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.clinic.update({ where: { id: doctor.clinicId }, data: { chargeForMaterials: true } });
    });
    const withMat = await createBillFromVisit(recp.accessToken, patientId, visitId);
    const material = withMat.json().data.items.find((i: { kind: string }) => i.kind === 'MATERIAL');
    expect(material).toBeTruthy();
    expect(material.description).toContain('Gloves');
    expect(material.quantity).toBe(2);
  });
});
