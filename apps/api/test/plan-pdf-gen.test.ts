import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, seedActivePlan } from './helpers.js';
import { storage } from '../src/lib/storage.js';
import { generateTreatmentPlanPdf, type TreatmentPlanPdfData } from '../src/lib/treatment-plan-pdf.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const base: TreatmentPlanPdfData = {
  clinicName: 'Smile Dental Care',
  clinicAddress: '12 MG Road, Bengaluru',
  doctorName: 'Asha Menon',
  qualification: 'BDS, MDS',
  registrationNumber: 'KA-DENT-12345',
  patientName: 'Meera Nair',
  patientAge: 34,
  patientGender: 'FEMALE',
  patientCode: 'PT-0001',
  planName: 'Root Canal Treatment',
  status: 'ACTIVE',
  estimatedCostPaise: 1500000,
  createdAt: new Date('2026-06-18'),
  procedures: [
    {
      name: 'RCT',
      toothNumbers: [26],
      totalSittings: 4,
      completedSittings: 2,
      status: 'IN_PROGRESS',
      sittings: [
        { sittingNumber: 1, date: new Date('2026-06-18'), notes: 'Access cavity', completed: true },
        { sittingNumber: 2, date: new Date('2026-06-22'), notes: 'Cleaning + filing', completed: true },
      ],
    },
  ],
  prescriptions: [{ date: new Date('2026-06-18'), medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }] }],
  xrayCount: 1,
};

describe('treatment-plan PDF', () => {
  it('generates a structurally valid multi-page PDF that grows with content', async () => {
    const buf = await generateTreatmentPlanPdf(base);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(800);
    const text = buf.toString('latin1');
    expect(text).toContain('%%EOF');
    // Overview + sittings + prescriptions + xrays ⇒ at least 4 page objects.
    expect((text.match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(4);

    // A plan with no prescriptions/xrays renders fewer pages → smaller document.
    const minimal = await generateTreatmentPlanPdf({ ...base, prescriptions: [], xrayCount: 0 });
    expect(minimal.length).toBeLessThan(buf.length);
  });

  it('GET /plans/:id/pdf returns a signed url and caches a real PDF in storage', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const { planId } = await seedActivePlan(app, doc.clinicId, doc.userId, patientId, {
      completedSittings: 2,
      totalSittings: 4,
    });

    const res = await app.inject({ method: 'GET', url: `/plans/${planId}/pdf`, headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().data.url).toBe('string');

    const stored = await storage.getObject(`clinics/${doc.clinicId}/plans/${planId}.pdf`);
    expect(stored.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TREATMENT_PLAN_PDF_GENERATED', entityId: planId },
    });
    expect(audit).toBeTruthy();
  });
});
