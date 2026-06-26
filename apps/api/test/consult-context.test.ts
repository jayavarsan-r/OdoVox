import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { encryptField } from '../src/lib/encryption.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('GET /consultations/:id context (Phase 4.5)', () => {
  it('surfaces the visit chief complaint, patient allergies/medical flags, and attached x-rays', async () => {
    const doctor = await createDoctorWithClinic(app);
    const { consultationId, visitId, patientId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {}, {
      allergiesEnc: encryptField('Penicillin'),
      medicalFlags: ['Diabetes'],
    });

    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.visit.update({ where: { id: visitId }, data: { chiefComplaint: 'Tooth pain upper left, cold-sensitive' } });
      await app.prisma.media.create({
        data: {
          clinicId: doctor.clinicId,
          patientId,
          visitId,
          type: 'XRAY',
          storageKey: `clinics/${doctor.clinicId}/media/x1.png`,
          mimeType: 'image/png',
          sizeBytes: 1024,
          uploadedById: doctor.userId,
        },
      });
    });

    const res = await app.inject({ method: 'GET', url: `/consultations/${consultationId}`, headers: authHeader(doctor.accessToken) });
    expect(res.statusCode).toBe(200);
    const ctx = res.json().data.context;
    expect(ctx.visit.chiefComplaint).toBe('Tooth pain upper left, cold-sensitive');
    expect(ctx.patient.allergies).toContain('Penicillin');
    expect(ctx.patient.medicalFlags).toContain('Diabetes');
    expect(ctx.xrays).toHaveLength(1);
    expect(ctx.xrays[0].type).toBe('XRAY');
    expect(ctx.xrays[0].mimeType).toBe('image/png');
  });

  it('only counts XRAY media (not other media types) and is empty when none attached', async () => {
    const doctor = await createDoctorWithClinic(app);
    const { consultationId, visitId, patientId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.media.create({
        data: { clinicId: doctor.clinicId, patientId, visitId, type: 'PHOTO', storageKey: 'k', mimeType: 'image/png', sizeBytes: 10, uploadedById: doctor.userId },
      });
    });
    const res = await app.inject({ method: 'GET', url: `/consultations/${consultationId}`, headers: authHeader(doctor.accessToken) });
    expect(res.json().data.context.xrays).toHaveLength(0);
  });

  it('does not leak another clinic’s consultation/x-rays (404 across clinics)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, clinicA.clinicId, clinicA.userId, {});
    const res = await app.inject({ method: 'GET', url: `/consultations/${consultationId}`, headers: authHeader(clinicB.accessToken) });
    expect(res.statusCode).toBe(404);
  });
});
