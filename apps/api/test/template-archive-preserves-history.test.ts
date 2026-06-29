import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, createPatient, authHeader } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('prescription templates — archiving preserves prescription history', () => {
  it('a prescription created from a template survives the template being archived', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);

    // Create a template, then snapshot its medicines into a real prescription (Phase 5 design:
    // prescriptions copy medicines at creation, they do NOT reference the template by id).
    const template = (
      await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(doc.accessToken),
        payload: {
          name: 'RCT pack',
          medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
        },
      })
    ).json().data;

    const rx = await app.prisma.prescription.create({
      data: {
        patientId,
        doctorId: doc.userId,
        medicines: template.medicines as object,
        reviewAfterDays: 7,
      },
    });

    // Archive the template.
    const del = await app.inject({
      method: 'DELETE',
      url: `/prescription-templates/${template.id}`,
      headers: authHeader(doc.accessToken),
    });
    expect(del.statusCode).toBe(200);

    // Prescription is untouched — medicines snapshot intact.
    const stored = await app.prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } });
    expect((stored.medicines as { name: string }[])[0]!.name).toBe('Amoxicillin');
  });
});
