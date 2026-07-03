import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';
import { runWithContext, runAsSystem } from '../src/lib/request-context.js';
import { processLabInbound } from '../src/lib/lab-transport/inbound-service.js';
import { extractCaseCode, matchConsentReply, matchStatusKeyword } from '../src/lib/lab-transport/keywords.js';
import type { LabVendor } from '@odovox/db';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

let seq = 0;
const wamid = () => `wamid_test_${Date.now()}_${seq++}`;

async function seed(s: ClinicSetup, opts: { consent?: boolean } = {}) {
  const vendorRes = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(s.accessToken),
    payload: {
      name: `Saveetha Lab ${Math.random().toString(36).slice(2, 6)}`,
      contactPhone: '9876500010',
      whatsappPhoneNumbers: ['9876500010'],
    },
  });
  const vendorId = vendorRes.json().data.id as string;
  if (opts.consent !== false) {
    await app.inject({
      method: 'POST',
      url: `/lab/vendors/${vendorId}/consent`,
      headers: authHeader(s.accessToken),
      payload: { action: 'mark_confirmed' },
    });
  }
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const caseRes = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(s.accessToken),
    payload: { patientId, vendorId, type: 'CROWN', teeth: [26] },
  });
  const caseId = caseRes.json().data.id as string;
  const caseCode = caseRes.json().data.caseCode as string;
  await app.inject({
    method: 'POST',
    url: `/lab/cases/${caseId}/transition`,
    headers: authHeader(s.accessToken),
    payload: { to: 'SENT' },
  });
  // PrismaPromises are lazy — await INSIDE runAsSystem so the query runs in the system context.
  const vendor = await runAsSystem(async () => await app.prisma.labVendor.findUniqueOrThrow({ where: { id: vendorId } }));
  return { vendor, caseId, caseCode, patientId };
}

const inbound = (vendor: LabVendor, event: Record<string, unknown>) =>
  runAsSystem(() =>
    processLabInbound(app.prisma, {
      vendor,
      event: { fromPhone: vendor.whatsappPhoneNumbers[0]!, type: 'text', providerMessageId: wamid(), ...event } as never,
    }),
  );

describe('tier 1 — structured button payload (§2.9)', () => {
  it('a status button transitions the case immediately, no LLM involved', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId } = await seed(s);

    const result = await inbound(vendor, {
      type: 'button_reply',
      buttonId: JSON.stringify({ action: 'status', caseId, to: 'ACKNOWLEDGED', label: '✅ Received' }),
    });
    expect(result).toMatchObject({ outcome: 'transitioned', caseId, newStatus: 'ACKNOWLEDGED', parseTier: 'button' });

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const c = await app.prisma.labCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(c.status).toBe('ACKNOWLEDGED');
      expect(c.statusUpdatedBy).toBe('lab_button');
      const event = await app.prisma.labCaseEvent.findFirstOrThrow({ where: { labCaseId: caseId, toStatus: 'ACKNOWLEDGED' } });
      expect(event.sourceLabMessageId).toBeTruthy(); // timeline links to the WhatsApp message
    });
  });

  it('replaying the same wamid is a duplicate no-op', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId } = await seed(s);
    const id = wamid();
    const payload = { type: 'button_reply', buttonId: JSON.stringify({ action: 'status', caseId, to: 'ACKNOWLEDGED', label: '✅' }), providerMessageId: id };

    const first = await inbound(vendor, payload);
    const replay = await inbound(vendor, payload);
    expect(first.outcome).toBe('transitioned');
    expect(replay.outcome).toBe('duplicate');
  });
});

describe('tier 2 — case code + keyword (§2.9)', () => {
  it('parses English: "DK-0042 ready anna, evening send" → READY', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId, caseCode } = await seed(s);
    await inbound(vendor, { type: 'button_reply', buttonId: JSON.stringify({ action: 'status', caseId, to: 'IN_PROGRESS', label: 'wip' }) });

    const result = await inbound(vendor, { text: `${caseCode} ready anna, evening send pannuvom` });
    expect(result).toMatchObject({ outcome: 'transitioned', caseId, newStatus: 'READY', parseTier: 'case_code' });

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const c = await app.prisma.labCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(c.statusUpdatedBy).toBe('lab_text');
      // T3 dispatch-confirm auto-fires when the lab reports READY.
      const t3 = await app.prisma.labMessage.findFirst({ where: { labCaseId: caseId, templateKey: 'lab_t3_dispatch' } });
      expect(t3).toBeTruthy();
    });
  });

  it('parses issue keywords: "SM-0001 crown damage aayiduchu" → ISSUE_RAISED with the verbatim note', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId, caseCode } = await seed(s);

    const result = await inbound(vendor, { text: `${caseCode} crown damage aayiduchu, remake pannanum` });
    expect(result).toMatchObject({ newStatus: 'ISSUE_RAISED', parseTier: 'case_code' });
    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const event = await app.prisma.labCaseEvent.findFirstOrThrow({ where: { labCaseId: caseId, toStatus: 'ISSUE_RAISED' } });
      expect(event.note).toContain('remake'); // doctor sees the lab's own words
    });
  });

  it('parses Tamil: "KV-0018 aachu" → READY; ambiguous text stays unresolved', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId, caseCode } = await seed(s);

    const ta = await inbound(vendor, { text: `${caseCode} முடிந்தது anna` });
    expect(ta).toMatchObject({ outcome: 'transitioned', caseId, newStatus: 'READY' });

    // "any update sir" — no code, no keyword → unresolved for tiers 3/4.
    const vague = await inbound(vendor, { text: 'any update sir' });
    expect(vague.outcome).toBe('unresolved');
  });

  it('keyword + code helpers are strict (pure)', () => {
    expect(extractCaseCode('case dk-0042 ready')).toBe('DK-0042');
    expect(extractCaseCode('no code here')).toBeNull();
    expect(matchStatusKeyword('ready sir')).toMatchObject({ status: 'READY' });
    expect(matchStatusKeyword('ho gaya')).toMatchObject({ status: 'READY', language: 'hi' });
    expect(matchStatusKeyword('started but there is a problem')).toMatchObject({ status: 'ISSUE_RAISED' });
    expect(matchStatusKeyword('hello doctor')).toBeNull();
    expect(matchConsentReply('YES confirm')).toBe('yes');
  });
});

describe('media auto-attach (§2.9.1)', () => {
  it('attaches inbound media when the lab has exactly one open case', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor, caseId } = await seed(s);

    const result = await inbound(vendor, { type: 'image', mediaUrl: 'mock://media/shade-photo', text: '' });
    expect(result.outcome).toBe('unresolved'); // no status info — media still lands on the case
    expect(result.caseId).toBe(caseId);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const media = await app.prisma.media.findFirstOrThrow({ where: { labCaseId: caseId, source: 'lab_whatsapp' } });
      expect(media.type).toBe('LAB_PHOTO');
    });
  });

  it('consent YES reply stamps consentLoggedAt (§2.11 step 4)', async () => {
    const s = await createDoctorWithClinic(app);
    const { vendor } = await seed(s, { consent: false });
    expect(vendor.consentLoggedAt).toBeNull();

    const result = await inbound(vendor, { text: 'YES' });
    expect(result.outcome).toBe('consent');
    const updated = await runAsSystem(async () => await app.prisma.labVendor.findUniqueOrThrow({ where: { id: vendor.id } }));
    expect(updated.consentLoggedAt).toBeTruthy();
  });
});
