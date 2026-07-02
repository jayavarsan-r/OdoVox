import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('case detail timeline (Phase 9.7 §2.13)', () => {
  it('GET /lab/cases/:id returns LabCaseEvent entries with trigger provenance, newest first', async () => {
    const s = await createDoctorWithClinic(app);
    const vendor = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(s.accessToken),
      payload: { name: 'Timeline Lab', contactPhone: '9876500003' },
    });
    const patientId = await createPatient(app, s.clinicId, s.userId);
    const created = await app.inject({
      method: 'POST',
      url: '/lab/cases',
      headers: authHeader(s.accessToken),
      payload: { patientId, vendorId: vendor.json().data.id, type: 'BRIDGE', teeth: [24, 25, 26] },
    });
    const caseId = created.json().data.id as string;

    for (const to of ['SENT', 'IN_PROGRESS', 'READY'] as const) {
      await app.inject({
        method: 'POST',
        url: `/lab/cases/${caseId}/transition`,
        headers: authHeader(s.accessToken),
        payload: { to, skipWhatsApp: true, note: to === 'READY' ? 'Lab called — ready' : undefined },
      });
    }

    const detail = await app.inject({ method: 'GET', url: `/lab/cases/${caseId}`, headers: authHeader(s.accessToken) });
    const events = detail.json().data.events as Array<{ toStatus: string; trigger: string; note: string | null }>;
    expect(events.map((e) => e.toStatus)).toEqual(['READY', 'IN_PROGRESS', 'SENT']);
    expect(events.every((e) => e.trigger === 'reception_manual')).toBe(true);
    expect(events[0]!.note).toBe('Lab called — ready');
    expect(detail.json().data.statusUpdatedBy).toBe('reception_manual');
  });
});
