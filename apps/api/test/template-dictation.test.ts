import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/mock-provider.js';
import { buildPrescriptionSystemInstruction } from '../src/lib/ai/prompts/clinical.js';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function putAudio(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

async function createTemplate(token: string, name: string, medicines: unknown[]) {
  return (
    await app.inject({
      method: 'POST',
      url: '/prescription-templates',
      headers: authHeader(token),
      payload: { name, medicines },
    })
  ).json().data;
}

describe('prescription dictation — template recognition', () => {
  it('prompt lists known templates and the extractor resolves a spoken name to applyTemplateId', async () => {
    const prompt = buildPrescriptionSystemInstruction({
      name: 'Asha',
      age: 40,
      allergies: [],
      medicalFlags: [],
      templates: [{ id: 'tpl_rct', name: 'RCT pack', tags: ['antibiotic'] }],
    });
    expect(prompt).toContain('KNOWN TEMPLATES IN THIS CLINIC');
    expect(prompt).toContain('tpl_rct');
    expect(prompt).toContain('applyTemplateId');

    const r = await new MockExtractor().extractPrescription('Apply RCT pack please.', {
      name: 'Asha',
      age: 40,
      allergies: [],
      medicalFlags: [],
      templates: [{ id: 'tpl_rct', name: 'RCT pack', tags: ['antibiotic'] }],
    });
    expect(r.applyTemplateId).toBe('tpl_rct');
  });

  it('dictate populates the template medicines and returns the templateUsed pill', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const tpl = await createTemplate(doctor.accessToken, 'RCT pack', [
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 },
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 },
    ]);
    const storageKey = await putAudio(doctor.clinicId, 'Apply RCT pack.');

    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { patientId, storageKey },
    });

    expect(res.statusCode).toBe(200);
    const { prescription, templateUsed } = res.json().data;
    expect(templateUsed).toMatchObject({ id: tpl.id, name: 'RCT pack' });
    const names = prescription.prescriptions.map((m: { name: string }) => m.name);
    expect(names).toEqual(['Amoxicillin', 'Ibuprofen']);

    // usageCount bumped + TEMPLATE_USED audited.
    const detail = await app.inject({
      method: 'GET',
      url: `/prescription-templates/${tpl.id}`,
      headers: authHeader(doctor.accessToken),
    });
    expect(detail.json().data.usageCount).toBe(1);
    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TEMPLATE_USED', entityId: tpl.id },
    });
    expect(audit).toBeTruthy();
  });

  it('merges template medicines with an explicitly dictated addition (template first)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await createTemplate(doctor.accessToken, 'RCT pack', [
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 },
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 },
    ]);
    const storageKey = await putAudio(
      doctor.clinicId,
      'RCT pack, also add Pantoprazole 40mg OD for 5 days.',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { patientId, storageKey },
    });

    expect(res.statusCode).toBe(200);
    const { prescription, templateUsed } = res.json().data;
    expect(templateUsed.name).toBe('RCT pack');
    const names = prescription.prescriptions.map((m: { name: string }) => m.name);
    // Template medicines first, then the dictated addition.
    expect(names).toEqual(['Amoxicillin', 'Ibuprofen', 'Pantoprazole']);
  });
});
