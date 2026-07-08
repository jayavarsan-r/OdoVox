import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ClinicalExtraction } from '@odovox/types';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

/**
 * Phase 9.6 Issue 5: a hallucinated "42" appeared next to a patient's name on the verification
 * card. Identity (name/age/phone/gender) must NEVER ride along with clinical extraction — it
 * comes from the patient record alone. Two layers pin this: the Zod contract strips unknown
 * identity keys, and a commit fed identity keys persists none of them.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const hallucinated = {
  procedure: 'RCT',
  teeth: [36],
  sittingCurrent: 1,
  sittingTotal: 1,
  status: 'COMPLETED' as const,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
  // Identity fields a misbehaving extractor might invent:
  name: 'Priya',
  age: 42,
  phone: '9876543210',
  gender: 'FEMALE',
};

describe('clinical extraction — identity fields are stripped', () => {
  it('ClinicalExtraction.parse drops name/age/phone/gender', () => {
    const parsed = ClinicalExtraction.parse(hallucinated);
    expect(parsed).not.toHaveProperty('name');
    expect(parsed).not.toHaveProperty('age');
    expect(parsed).not.toHaveProperty('phone');
    expect(parsed).not.toHaveProperty('gender');
    expect(parsed.procedure).toBe('RCT');
  });

  it('a confirm fed identity fields persists none of them on the consultation', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, hallucinated);

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: hallucinated,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    const saved = consult.structuredData as Record<string, unknown>;
    expect(saved).not.toHaveProperty('name');
    expect(saved).not.toHaveProperty('age');
    expect(saved).not.toHaveProperty('phone');
    expect(saved).not.toHaveProperty('gender');
    expect(saved.procedure).toBe('RCT');
  });
});
