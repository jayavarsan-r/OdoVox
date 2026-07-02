import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function seed(s: ClinicSetup, vendorOver: Record<string, unknown> = {}) {
  const vendor = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(s.accessToken),
    payload: {
      name: `Rajesh Lab ${Math.random().toString(36).slice(2, 6)}`,
      contactPhone: '9876500002',
      whatsappPhoneNumbers: ['9876500002'],
      ...vendorOver,
    },
  });
  const vendorId = vendor.json().data.id as string;
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const created = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(s.accessToken),
    payload: { patientId, vendorId, type: 'CROWN', teeth: [26], shade: 'A2' },
  });
  return { vendorId, caseId: created.json().data.id as string };
}

describe('lab consent gate + T1/T4 sends (Phase 9.7 §2.7/§2.11)', () => {
  it('blocks a manual Send for a non-consented lab (422 LAB_SEND_NO_CONSENT), case stays DRAFT', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seed(s);

    const res = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/transition`,
      headers: authHeader(s.accessToken),
      payload: { to: 'SENT' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('LAB_SEND_NO_CONSENT');

    const detail = await app.inject({ method: 'GET', url: `/lab/cases/${caseId}`, headers: authHeader(s.accessToken) });
    expect(detail.json().data.status).toBe('DRAFT');
  });

  it('skipWhatsApp marks SENT without any outbound (lab not on WhatsApp — still a useful tracker)', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seed(s);

    const res = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/transition`,
      headers: authHeader(s.accessToken),
      payload: { to: 'SENT', skipWhatsApp: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('SENT');

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      expect(await app.prisma.labMessage.count({ where: { labCaseId: caseId } })).toBe(0);
    });
  });

  it('after consent, → SENT fires T1 with the case code, and → RECEIVED auto-fires T4', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId, vendorId } = await seed(s);

    const consent = await app.inject({
      method: 'POST',
      url: `/lab/vendors/${vendorId}/consent`,
      headers: authHeader(s.accessToken),
      payload: { action: 'mark_confirmed' },
    });
    expect(consent.statusCode).toBe(200);
    expect(consent.json().data.consentLoggedAt).toBeTruthy();

    const sent = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/transition`,
      headers: authHeader(s.accessToken),
      payload: { to: 'SENT' },
    });
    expect(sent.statusCode).toBe(200);
    const caseCode = sent.json().data.caseCode as string;

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const t1 = await app.prisma.labMessage.findFirstOrThrow({ where: { labCaseId: caseId, templateKey: 'lab_t1_new_case' } });
      expect(t1.direction).toBe('OUTBOUND');
      expect(t1.body).toContain(caseCode); // the threading key rides every message
      expect(t1.body).toContain('A2');
    });

    for (const to of ['ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'RECEIVED'] as const) {
      const hop = await app.inject({
        method: 'POST',
        url: `/lab/cases/${caseId}/transition`,
        headers: authHeader(s.accessToken),
        payload: { to },
      });
      expect(hop.statusCode).toBe(200);
    }
    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const t4 = await app.prisma.labMessage.findFirst({ where: { labCaseId: caseId, templateKey: 'lab_t4_receipt' } });
      expect(t4).toBeTruthy();
      expect(t4!.body).toContain('Thank you');
    });
  });
});
