import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  joinReceptionist,
  seedConsultation,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { encryptField } from '../src/lib/encryption.js';

/**
 * Frame 42's timeline. It carries two kinds of entry, and the difference is the point:
 * a visit happened on a day, while a recorded allergy has no end and constrains every
 * prescription written after it.
 *
 * The clinical boundary (B1/B4) applies here as everywhere else — a timeline is not a
 * loophole through which reception sees medical facts.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function seedWithAllergy(clinicId: string, doctorId: string) {
  const { patientId, visitId } = await seedConsultation(app, clinicId, doctorId, {});
  await runWithContext({ clinicId, userId: doctorId }, async () => {
    await app.prisma.patient.update({
      where: { id: patientId },
      data: { allergiesEnc: encryptField('Penicillin') },
    });
    await app.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED', startedAt: new Date('2026-06-28T04:00:00Z') },
    });
  });
  return patientId;
}

describe('patient history', () => {
  it('returns the visit timeline', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await seedWithAllergy(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/history`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const visits = res.json().data.entries.filter((e: { kind: string }) => e.kind === 'visit');
    expect(visits.length).toBeGreaterThan(0);
    expect(visits[0]).toHaveProperty('doctorName');
    expect(visits[0]).toHaveProperty('confirmed');
  });

  it('gives a DOCTOR the recorded allergy as a permanent fact', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await seedWithAllergy(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/history`,
      headers: authHeader(doc.accessToken),
    });
    const fact = res.json().data.entries.find((e: { kind: string }) => e.kind === 'fact');
    expect(fact).toBeDefined();
    expect(fact.title).toContain('Penicillin');
    // No recorded date exists for an allergy, so the entry carries none rather than a
    // guessed year.
    expect(fact.at).toBeNull();
  });

  it('gives a RECEPTIONIST the timeline with NO medical facts', async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);
    const patientId = await seedWithAllergy(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/history`,
      headers: authHeader(recep.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.entries.some((e: { kind: string }) => e.kind === 'fact')).toBe(false);
    // The plaintext must not appear anywhere in the payload — not merely be unrendered.
    expect(JSON.stringify(body)).not.toContain('Penicillin');
    // Reception still gets the operational timeline they book and bill from.
    expect(body.entries.some((e: { kind: string }) => e.kind === 'visit')).toBe(true);
  });

  it('does not invent a fact for a patient with no allergies on file', async () => {
    const doc = await createDoctorWithClinic(app);
    const { patientId } = await seedConsultation(app, doc.clinicId, doc.userId, {});

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/history`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.json().data.entries.some((e: { kind: string }) => e.kind === 'fact')).toBe(false);
  });
});
