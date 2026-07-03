import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LabVendor } from '@odovox/db';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';
import { runAsSystem, runWithContext } from '../src/lib/request-context.js';
import { processLabInbound } from '../src/lib/lab-transport/inbound-service.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

let seq = 0;
const wamid = () => `wamid_t3_${Date.now()}_${seq++}`;

async function seed(s: ClinicSetup, caseCount = 1) {
  const vendorRes = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(s.accessToken),
    payload: { name: `Kavery Ceramics ${Math.random().toString(36).slice(2, 6)}`, contactPhone: '9876500030', whatsappPhoneNumbers: ['9876500030'] },
  });
  const vendorId = vendorRes.json().data.id as string;
  await app.inject({ method: 'POST', url: `/lab/vendors/${vendorId}/consent`, headers: authHeader(s.accessToken), payload: { action: 'mark_confirmed' } });
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const cases: Array<{ id: string; caseCode: string }> = [];
  for (let i = 0; i < caseCount; i++) {
    const caseRes = await app.inject({
      method: 'POST',
      url: '/lab/cases',
      headers: authHeader(s.accessToken),
      payload: { patientId, vendorId, type: i === 0 ? 'CROWN' : 'BRIDGE', teeth: [26 + i] },
    });
    const caseId = caseRes.json().data.id as string;
    await app.inject({ method: 'POST', url: `/lab/cases/${caseId}/transition`, headers: authHeader(s.accessToken), payload: { to: 'SENT' } });
    cases.push({ id: caseId, caseCode: caseRes.json().data.caseCode as string });
  }
  const vendor = await runAsSystem(async () => await app.prisma.labVendor.findUniqueOrThrow({ where: { id: vendorId } }));
  return { vendor, cases };
}

const inbound = (vendor: LabVendor, text: string) =>
  runAsSystem(() =>
    processLabInbound(app.prisma, {
      vendor,
      event: { fromPhone: vendor.whatsappPhoneNumbers[0]!, type: 'text', text, providerMessageId: wamid() },
    }),
  );

describe('tier 3 — LLM fallback with strict gates (§2.9)', () => {
  it('single open case + clear status @ ≥0.85 → auto-applies as llm_parse', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, cases } = await seed(s, 1);

    // No case code — tier 2 needs BOTH code+keyword, so this reaches tier 3, where the
    // single-open-case rule lifts caseCodeConfidence to 1.0.
    const result = await inbound(vendor, 'working on it, will share photo tomorrow');
    expect(result).toMatchObject({ outcome: 'transitioned', caseId: cases[0]!.id, newStatus: 'IN_PROGRESS', parseTier: 'llm' });

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const c = await app.prisma.labCase.findUniqueOrThrow({ where: { id: cases[0]!.id } });
      expect(c.statusUpdatedBy).toBe('llm_parse');
      const msg = await app.prisma.labMessage.findFirstOrThrow({ where: { id: result.labMessageId } });
      expect(Number(msg.parseConfidence)).toBeGreaterThanOrEqual(0.85);
    });
  });

  it('single-candidate rule: 2 open cases + no code → NO auto-transition, suggestion goes to the inbox', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, cases } = await seed(s, 2);

    const result = await inbound(vendor, 'ready sir, evening send');
    expect(result.outcome).toBe('unresolved'); // ambiguity → tier 4, never a guess

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      for (const c of cases) {
        const row = await app.prisma.labCase.findUniqueOrThrow({ where: { id: c.id } });
        expect(row.status).toBe('SENT'); // untouched
      }
      const msg = await app.prisma.labMessage.findFirstOrThrow({ where: { id: result.labMessageId } });
      expect(msg.resolved).toBe(false);
      expect(msg.llmSuggestion).toMatchObject({ newStatus: 'READY' }); // amber box in the inbox
      expect(Number(msg.parseConfidence)).toBeLessThan(0.85);
    });
  });
});

describe('tier 4 — reception inbox resolves + logs labeled examples (§2.9/§2.12)', () => {
  it('link-to-case with a status transitions as reception_manual and records the example', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, cases } = await seed(s, 2);
    const result = await inbound(vendor, 'any update sir'); // no signal at all
    expect(result.outcome).toBe('unresolved');

    const resolve = await app.inject({
      method: 'POST',
      url: `/lab/messages/${result.labMessageId}/resolve`,
      headers: authHeader(s.accessToken),
      payload: { action: 'link', caseId: cases[0]!.id, newStatus: 'ACKNOWLEDGED' },
    });
    expect(resolve.statusCode).toBe(200);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const c = await app.prisma.labCase.findUniqueOrThrow({ where: { id: cases[0]!.id } });
      expect(c.status).toBe('ACKNOWLEDGED');
      expect(c.statusUpdatedBy).toBe('reception_manual');
      const example = await app.prisma.labParseTrainingExample.findFirstOrThrow({ where: { labMessageId: result.labMessageId } });
      expect(example).toMatchObject({ action: 'link', resolvedCaseId: cases[0]!.id, resolvedStatus: 'ACKNOWLEDGED', body: 'any update sir' });
      const msg = await app.prisma.labMessage.findUniqueOrThrow({ where: { id: result.labMessageId! } });
      expect(msg.resolved).toBe(true);
      expect(msg.labCaseId).toBe(cases[0]!.id);
    });
  });

  it('GET /lab/messages?filter=needs_action lists only unresolved inbound rows', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor } = await seed(s, 2);
    await inbound(vendor, 'price update please'); // unresolved

    const res = await app.inject({ method: 'GET', url: '/lab/messages?filter=needs_action', headers: authHeader(s.accessToken) });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items as Array<{ resolved: boolean; vendorName: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => !i.resolved)).toBe(true);
    expect(items[0]!.vendorName).toContain('Kavery');
  });
});

describe('one-tap undo of LLM transitions (§2.13)', () => {
  it('reverses the status as reception_manual and marks the event undone', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, cases } = await seed(s, 1);
    const applied = await inbound(vendor, 'working on it, started today');
    expect(applied.parseTier).toBe('llm');

    const event = await runAsSystem(async () =>
      app.prisma.labCaseEvent.findFirstOrThrow({ where: { labCaseId: cases[0]!.id, trigger: 'llm_parse' } }),
    );
    const undo = await app.inject({ method: 'POST', url: `/lab/events/${event.id}/undo`, headers: authHeader(s.accessToken) });
    expect(undo.statusCode).toBe(200);
    expect(undo.json().data.status).toBe('SENT'); // back where it was

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const undone = await app.prisma.labCaseEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(undone.undoneAt).toBeTruthy();
    });

    // A second undo of the same event is rejected.
    const again = await app.inject({ method: 'POST', url: `/lab/events/${event.id}/undo`, headers: authHeader(s.accessToken) });
    expect(again.statusCode).toBe(409);
  });
});

describe('per-lab analytics (§2.14)', () => {
  it('computes turnaround, on-time rate, volume and issue rate from real case data', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, cases } = await seed(s, 2);
    // Case 1: READY on time. Case 2: issue raised.
    await inbound(vendor, `${cases[0]!.caseCode} ready sir`);
    await inbound(vendor, `${cases[1]!.caseCode} problem sir remake`);

    const res = await app.inject({ method: 'GET', url: `/lab/vendors/${vendor.id}/analytics`, headers: authHeader(s.accessToken) });
    expect(res.statusCode).toBe(200);
    const a = res.json().data;
    expect(a.volume90).toBe(2);
    expect(a.turnaroundDaysAvg).not.toBeNull();
    expect(a.onTimeRate).toBe(1); // returned today, expected in 7 days
    expect(a.issuesRaised).toBe(1);
    expect(a.issueRate).toBe(0.5);
    expect(a.costPerCasePaise).toBeGreaterThan(0); // T1 sends logged against the cases
  });
});
