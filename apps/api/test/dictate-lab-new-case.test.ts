import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/mock-provider.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function putAudio(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

describe('POST /lab/dictate/new-case (Phase 9.7 W1.2.4)', () => {
  it('extracts type, teeth, shade, material, turnaround and cost from a spoken brief', async () => {
    const s = await createDoctorWithClinic(app);
    const key = await putAudio(s.clinicId, 'Zirconia crown for Ramesh tooth 26 shade A2 from Saveetha lab in 7 days for 3000 rupees');

    const res = await app.inject({
      method: 'POST',
      url: '/lab/dictate/new-case',
      headers: authHeader(s.accessToken),
      payload: { storageKey: key },
    });

    expect(res.statusCode).toBe(200);
    const { extraction } = res.json().data;
    expect(extraction.type).toBe('CROWN');
    expect(extraction.teeth).toEqual([26]);
    expect(extraction.shade).toBe('A2');
    expect(extraction.material).toBe('zirconia');
    expect(extraction.expectedTurnaroundDays).toBe(7);
    expect(extraction.costPaise).toBe(300000);
    expect(extraction.patientName).toMatch(/Ramesh/);
  });

  it('fuzzy-matches the spoken lab against clinic vendors', async () => {
    const s = await createDoctorWithClinic(app);
    const vendor = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(s.accessToken),
      payload: { name: 'Saveetha Dental Lab', contactPhone: '9876500004' },
    });
    const vendorId = vendor.json().data.id as string;

    const key = await putAudio(s.clinicId, 'partial denture for Lakshmi from Saveetha lab in two weeks');
    const res = await app.inject({
      method: 'POST',
      url: '/lab/dictate/new-case',
      headers: authHeader(s.accessToken),
      payload: { storageKey: key },
    });

    const data = res.json().data;
    expect(data.extraction.type).toBe('DENTURE_PARTIAL');
    expect(data.extraction.expectedTurnaroundDays).toBe(14);
    expect(data.vendorMatch).toBeTruthy();
    expect(data.vendorMatch.id).toBe(vendorId);
  });
});

describe('lab-case suggestion from voice consultation (Phase 9.7 §2.5.1)', () => {
  it('clinical mock extracts the suggestion, and confirm creates a vendorless DRAFT case', async () => {
    const s = await createDoctorWithClinic(app);
    const { seedConsultation } = await import('./helpers.js');
    const { commitConsultation } = await import('../src/lib/consultation/commit.js');

    const structured = {
      procedure: 'RCT',
      teeth: [26],
      prescriptions: [],
      toothStatusUpdates: [],
      labCaseSuggestion: { type: 'CROWN', teeth: [26], dueInDays: 7 },
      clarifications: [],
      safetyWarnings: [],
    };
    const { consultationId } = await seedConsultation(app, s.clinicId, s.userId, structured);

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: structured,
      userId: s.userId,
      confirmedWithWarning: false,
    });
    expect(result.labCaseId).toBeTruthy();

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const labCase = await app.prisma.labCase.findUniqueOrThrow({ where: { id: result.labCaseId! } });
      expect(labCase.status).toBe('DRAFT');
      expect(labCase.vendorId).toBeNull(); // reception picks the lab before Send
      expect(labCase.type).toBe('CROWN');
      expect(labCase.teeth).toEqual([26]);
      expect(labCase.caseCode).toMatch(/^[A-Z]{2,3}-\d{4}$/);
      expect(labCase.expectedReturnAt).toBeTruthy();
      const event = await app.prisma.labCaseEvent.findFirstOrThrow({ where: { labCaseId: labCase.id } });
      expect(event.trigger).toBe('reception_voice');
    });
  });

  it('the clinical mock only suggests when an impression was explicitly mentioned', async () => {
    const { MockExtractor } = await import('../src/lib/ai/mock-extractor.js');
    const mock = new MockExtractor({ latencyMs: 0 });
    const ctx = { name: 'X', age: 30, gender: null, allergies: [], medicalFlags: [], currentPlanSummary: null, lastVisitSummary: null, chiefComplaint: null, activePlans: [] };

    const withImpression = await mock.extractClinical('Took the impression for a crown on tooth 26, crown after one week', ctx);
    expect(withImpression.labCaseSuggestion).toMatchObject({ type: 'CROWN', dueInDays: 7 });

    const without = await mock.extractClinical('Crown fitting done on tooth 26', ctx);
    expect(without.labCaseSuggestion).toBeNull(); // never invented
  });
});
