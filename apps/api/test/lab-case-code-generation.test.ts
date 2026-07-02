import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { deriveCaseCodePrefix, formatCaseCode } from '../src/lib/lab/case-code.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('case codes (Phase 9.7 §2.4)', () => {
  it('derives 2-3 letter prefixes and zero-pads the sequence', () => {
    expect(deriveCaseCodePrefix('Dental Klinik')).toBe('DK');
    expect(deriveCaseCodePrefix('Smile Dental Care')).toBe('SDC');
    expect(deriveCaseCodePrefix('Smile')).toBe('SM');
    expect(formatCaseCode('DK', 42)).toBe('DK-0042');
    expect(formatCaseCode('SM', 12345)).toBe('SM-12345');
  });

  it('allocates sequential unique codes per clinic at case creation', async () => {
    const s = await createDoctorWithClinic(app); // clinic "Smile Dental Care" → SDC
    const vendor = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(s.accessToken),
      payload: { name: 'Kavery Ceramics', contactPhone: '9876500001' },
    });
    const vendorId = vendor.json().data.id as string;
    const patientId = await createPatient(app, s.clinicId, s.userId);

    const codes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/lab/cases',
        headers: authHeader(s.accessToken),
        payload: { patientId, vendorId, type: 'CROWN', teeth: [26] },
      });
      expect(res.statusCode).toBe(201);
      codes.push(res.json().data.caseCode as string);
    }
    expect(codes).toEqual(['SDC-0001', 'SDC-0002', 'SDC-0003']);
    expect(new Set(codes).size).toBe(3);
  });
});
