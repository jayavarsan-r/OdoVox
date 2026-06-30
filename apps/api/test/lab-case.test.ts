import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  joinDoctor,
  joinReceptionist,
  type ClinicSetup,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function makeVendor(doc: ClinicSetup): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(doc.accessToken),
    payload: { name: 'Lab Co', contactPhone: '9840011111', defaultTurnaroundDays: 7, specialties: ['crown'] },
  });
  return res.json().data.id;
}

async function makeCase(doc: ClinicSetup, over: Record<string, unknown> = {}): Promise<{ id: string; vendorId: string; patientId: string }> {
  const vendorId = await makeVendor(doc);
  const patientId = await createPatient(app, doc.clinicId, doc.userId);
  const res = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(doc.accessToken),
    payload: { patientId, vendorId, type: 'CROWN', teeth: [26], material: 'Zirconia', shade: 'A2', ...over },
  });
  if (res.statusCode !== 201) throw new Error(`create case failed: ${res.statusCode} ${res.body}`);
  return { id: res.json().data.id, vendorId, patientId };
}

const post = (doc: ClinicSetup, url: string, payload: unknown = {}) =>
  app.inject({ method: 'POST', url, headers: authHeader(doc.accessToken), payload });

describe('Lab case CRUD', () => {
  it('creates a DRAFT case with an auto case number', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    const detail = await app.inject({ method: 'GET', url: `/lab/cases/${id}`, headers: authHeader(doc.accessToken) });
    expect(detail.statusCode).toBe(200);
    const c = detail.json().data;
    expect(c.status).toBe('DRAFT');
    expect(c.caseNumber).toMatch(/^LC-[A-Z2-9]{8}$/);
    expect(c.type).toBe('CROWN');
  });

  it('lists, filters by status and searches by case number', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    const sent = await makeCase(doc);
    await post(doc, `/lab/cases/${sent.id}/send`);

    const all = await app.inject({ method: 'GET', url: '/lab/cases', headers: authHeader(doc.accessToken) });
    expect(all.json().data.items.length).toBeGreaterThanOrEqual(2);

    const draftOnly = await app.inject({ method: 'GET', url: '/lab/cases?status=DRAFT', headers: authHeader(doc.accessToken) });
    const draftIds = draftOnly.json().data.items.map((x: { id: string }) => x.id);
    expect(draftIds).toContain(id);
    expect(draftIds).not.toContain(sent.id);

    const caseNumber = all.json().data.items.find((x: { id: string }) => x.id === id).caseNumber;
    const search = await app.inject({
      method: 'GET',
      url: `/lab/cases?search=${encodeURIComponent(caseNumber)}`,
      headers: authHeader(doc.accessToken),
    });
    expect(search.json().data.items.some((x: { id: string }) => x.id === id)).toBe(true);
  });

  it('paginates with a cursor', async () => {
    const doc = await createDoctorWithClinic(app);
    for (let i = 0; i < 3; i++) await makeCase(doc);
    const page1 = await app.inject({ method: 'GET', url: '/lab/cases?limit=2', headers: authHeader(doc.accessToken) });
    const body1 = page1.json().data;
    expect(body1.items.length).toBe(2);
    expect(body1.nextCursor).toBeTruthy();
    const page2 = await app.inject({
      method: 'GET',
      url: `/lab/cases?limit=2&cursor=${body1.nextCursor}`,
      headers: authHeader(doc.accessToken),
    });
    expect(page2.json().data.items.length).toBeGreaterThanOrEqual(1);
    // No overlap between pages.
    const ids1 = new Set(body1.items.map((x: { id: string }) => x.id));
    expect(page2.json().data.items.every((x: { id: string }) => !ids1.has(x.id))).toBe(true);
  });

  it('only allows editing DRAFT or SENT cases', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    const okEdit = await app.inject({
      method: 'PATCH',
      url: `/lab/cases/${id}`,
      headers: authHeader(doc.accessToken),
      payload: { shade: 'A3' },
    });
    expect(okEdit.statusCode).toBe(200);
    // Drive to READY, then editing must fail.
    await post(doc, `/lab/cases/${id}/send`);
    await post(doc, `/lab/cases/${id}/receive`);
    const blocked = await app.inject({
      method: 'PATCH',
      url: `/lab/cases/${id}`,
      headers: authHeader(doc.accessToken),
      payload: { shade: 'B1' },
    });
    expect(blocked.statusCode).toBe(400);
  });

  it('stores clinical notes encrypted at rest', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc, { notes: 'Patient prefers natural shade' });
    const row = await runWithContext({ clinicId: doc.clinicId }, async () => {
      return await app.prisma.labCase.findFirstOrThrow({ where: { id } });
    });
    expect(row.notesEnc).toBeTruthy();
    expect(row.notesEnc).not.toContain('natural shade');
    // But the API decrypts it on read.
    const detail = await app.inject({ method: 'GET', url: `/lab/cases/${id}`, headers: authHeader(doc.accessToken) });
    expect(detail.json().data.notes).toBe('Patient prefers natural shade');
  });
});

describe('Lab case transitions', () => {
  it('runs the full happy path DRAFT→SENT→IN_PROGRESS→READY→DELIVERED→COMPLETED', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    const steps: Array<[string, string]> = [
      ['send', 'SENT'],
      ['confirm-received', 'IN_PROGRESS'],
      ['receive', 'READY'],
      ['deliver', 'DELIVERED'],
      ['complete', 'COMPLETED'],
    ];
    for (const [action, expected] of steps) {
      const res = await post(doc, `/lab/cases/${id}/${action}`);
      expect(res.statusCode, `${action} -> ${res.body}`).toBe(200);
      expect(res.json().data.status).toBe(expected);
    }
  });

  it('supports the rework re-cycle READY→RETURNED_FOR_REWORK→SENT', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    await post(doc, `/lab/cases/${id}/send`);
    await post(doc, `/lab/cases/${id}/receive`); // READY
    const rework = await post(doc, `/lab/cases/${id}/rework`, { reason: 'Margins off' });
    expect(rework.statusCode).toBe(200);
    expect(rework.json().data.status).toBe('RETURNED_FOR_REWORK');
    const reSend = await post(doc, `/lab/cases/${id}/send`);
    expect(reSend.statusCode).toBe(200);
    expect(reSend.json().data.status).toBe('SENT');
  });

  it('rejects invalid transitions with 409 INVALID_TRANSITION', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    // DRAFT → receive (READY) is not allowed.
    const bad = await post(doc, `/lab/cases/${id}/receive`);
    expect(bad.statusCode).toBe(409);
    expect(bad.json().error.code).toBe('INVALID_TRANSITION');
  });

  it('treats COMPLETED as terminal (409 on any further transition)', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    for (const a of ['send', 'confirm-received', 'receive', 'deliver', 'complete']) await post(doc, `/lab/cases/${id}/${a}`);
    const cancel = await post(doc, `/lab/cases/${id}/cancel`, { reason: 'too late' });
    expect(cancel.statusCode).toBe(409);
  });

  it('deliver with requireRework marks rework and clones a linked case', async () => {
    const doc = await createDoctorWithClinic(app);
    const { id } = await makeCase(doc);
    await post(doc, `/lab/cases/${id}/send`);
    await post(doc, `/lab/cases/${id}/receive`); // READY
    const deliver = await post(doc, `/lab/cases/${id}/deliver`, { requireRework: true, reworkReason: 'High bite' });
    expect(deliver.statusCode).toBe(200);
    expect(deliver.json().data.status).toBe('RETURNED_FOR_REWORK');

    const clone = await runWithContext({ clinicId: doc.clinicId }, async () => {
      return await app.prisma.labCase.findFirst({ where: { reworkOfId: id } });
    });
    expect(clone).not.toBeNull();
    expect(clone!.status).toBe('DRAFT');
    expect(clone!.teeth).toEqual([26]);
  });
});

describe('Lab case number uniqueness', () => {
  it('generates distinct case numbers across many concurrent creates', async () => {
    const doc = await createDoctorWithClinic(app);
    const vendorId = await makeVendor(doc);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const results = await Promise.all(
      Array.from({ length: 12 }).map(() =>
        app.inject({
          method: 'POST',
          url: '/lab/cases',
          headers: authHeader(doc.accessToken),
          payload: { patientId, vendorId, type: 'CROWN', teeth: [11] },
        }),
      ),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const numbers = results.map((r) => r.json().data.caseNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe('Lab case RBAC + isolation', () => {
  it('receptionist cannot create a case (403) but can deliver/cancel', async () => {
    const doc = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doc.joinCode);
    const vendorId = await makeVendor(doc);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);

    const create = await app.inject({
      method: 'POST',
      url: '/lab/cases',
      headers: authHeader(recp.accessToken),
      payload: { patientId, vendorId, type: 'CROWN', teeth: [26] },
    });
    expect(create.statusCode).toBe(403);

    // Doctor creates + drives to READY; receptionist may deliver.
    const { id } = await makeCase(doc);
    await post(doc, `/lab/cases/${id}/send`);
    await post(doc, `/lab/cases/${id}/receive`);
    const deliver = await app.inject({
      method: 'POST',
      url: `/lab/cases/${id}/deliver`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(deliver.statusCode).toBe(200);
  });

  it('receptionist cannot send a case (403)', async () => {
    const doc = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doc.joinCode);
    const { id } = await makeCase(doc);
    const res = await app.inject({ method: 'POST', url: `/lab/cases/${id}/send`, headers: authHeader(recp.accessToken), payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it('a doctor cannot send another doctor’s case (403)', async () => {
    const doc = await createDoctorWithClinic(app);
    const doc2 = await joinDoctor(app, doc.joinCode);
    const { id } = await makeCase(doc); // owned by doc
    const res = await app.inject({ method: 'POST', url: `/lab/cases/${id}/send`, headers: authHeader(doc2.accessToken), payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it('a case from clinic A is invisible to clinic B (404)', async () => {
    const docA = await createDoctorWithClinic(app);
    const docB = await createDoctorWithClinic(app);
    const { id } = await makeCase(docA);
    const res = await app.inject({ method: 'GET', url: `/lab/cases/${id}`, headers: authHeader(docB.accessToken) });
    expect(res.statusCode).toBe(404);
  });
});
