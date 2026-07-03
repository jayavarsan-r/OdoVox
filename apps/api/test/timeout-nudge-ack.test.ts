import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';
import { runAsSystem } from '../src/lib/request-context.js';
import { runLabTimeoutSweep } from '../src/queues/lab-timeout-sweep.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function sentCase(s: ClinicSetup, opts: { paused?: boolean } = {}) {
  const vendorRes = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(s.accessToken),
    payload: { name: `Nudge Lab ${Math.random().toString(36).slice(2, 6)}`, contactPhone: '9876500020', whatsappPhoneNumbers: ['9876500020'] },
  });
  const vendorId = vendorRes.json().data.id as string;
  await app.inject({ method: 'POST', url: `/lab/vendors/${vendorId}/consent`, headers: authHeader(s.accessToken), payload: { action: 'mark_confirmed' } });
  if (opts.paused) {
    await app.inject({ method: 'POST', url: `/lab/vendors/${vendorId}/automation`, headers: authHeader(s.accessToken), payload: { paused: true } });
  }
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const caseRes = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(s.accessToken),
    payload: { patientId, vendorId, type: 'CROWN', teeth: [26] },
  });
  const caseId = caseRes.json().data.id as string;
  await app.inject({ method: 'POST', url: `/lab/cases/${caseId}/transition`, headers: authHeader(s.accessToken), payload: { to: 'SENT' } });
  // Backdate the SENT transition so the sweep sees 24h of silence. (Await inside runAsSystem —
  // PrismaPromises are lazy and must execute within the system context.)
  await runAsSystem(async () => {
    await app.prisma.labCase.update({ where: { id: caseId }, data: { statusUpdatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000) } });
  });
  return { caseId, vendorId };
}

describe('lab timeout sweep (§2.10)', () => {
  it('SENT + 24h silence → sends exactly one T2 nudge, capped per 24h, and never changes status', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await sentCase(s);

    const first = await runLabTimeoutSweep({ prisma: app.prisma });
    expect(first.nudged).toContain(caseId);

    // Second sweep within 24h: the cap holds — no spam.
    const second = await runLabTimeoutSweep({ prisma: app.prisma });
    expect(second.nudged).not.toContain(caseId);

    await runAsSystem(async () => {
      const nudges = await app.prisma.labMessage.count({ where: { labCaseId: caseId, templateKey: 'lab_t2_nudge' } });
      expect(nudges).toBe(1);
      const c = await app.prisma.labCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(c.status).toBe('SENT'); // timeouts alert/nudge — they NEVER move a case
    });
  });

  it('automationPaused labs get no nudges (manual tracking keeps working)', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await sentCase(s, { paused: true });

    const sweep = await runLabTimeoutSweep({ prisma: app.prisma });
    expect(sweep.nudged).not.toContain(caseId);
    await runAsSystem(async () => {
      const nudges = await app.prisma.labMessage.count({ where: { labCaseId: caseId, templateKey: 'lab_t2_nudge' } });
      expect(nudges).toBe(0);
      // Manual buttons still work on a paused lab.
    });
    const manual = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/transition`,
      headers: authHeader(s.accessToken),
      payload: { to: 'ACKNOWLEDGED' },
    });
    expect(manual.statusCode).toBe(200);
  });
});
