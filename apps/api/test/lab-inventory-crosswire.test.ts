import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function vendor(doc: ClinicSetup): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/lab/vendors', headers: authHeader(doc.accessToken), payload: { name: 'V', contactPhone: '9840000000', defaultTurnaroundDays: 7, specialties: [] } });
  return r.json().data.id;
}
async function labCase(doc: ClinicSetup, patientId: string, vendorId: string): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/lab/cases', headers: authHeader(doc.accessToken), payload: { patientId, vendorId, type: 'CROWN', teeth: [26] } });
  return r.json().data.id;
}
async function setupItem(doc: ClinicSetup, reorderLevel = 5): Promise<string> {
  const cat = await app.inject({ method: 'POST', url: '/inventory/categories', headers: authHeader(doc.accessToken), payload: { name: `C-${Math.random().toString(36).slice(2, 7)}` } });
  const item = await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(doc.accessToken), payload: { categoryId: cat.json().data.id, name: 'Composite', unitOfMeasure: 'piece', reorderLevel } });
  return item.json().data.id;
}
const post = (doc: ClinicSetup, url: string, body: unknown = {}) => app.inject({ method: 'POST', url, headers: authHeader(doc.accessToken), payload: body });
const needsYou = (doc: ClinicSetup) => app.inject({ method: 'GET', url: '/home/needs-you', headers: authHeader(doc.accessToken) });

describe('Doctor Home "Needs You" cross-wires', () => {
  it('includes a READY lab case', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const id = await labCase(doc, patientId, await vendor(doc));
    await post(doc, `/lab/cases/${id}/send`);
    await post(doc, `/lab/cases/${id}/receive`); // READY
    const res = await needsYou(doc);
    const kinds = res.json().data.items.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain('LAB_READY');
    expect(res.json().data.items.find((i: { kind: string }) => i.kind === 'LAB_READY').href).toBe(`/lab/${id}`);
  });

  it('includes an overdue lab case (sent, expected return in the past)', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const id = await labCase(doc, patientId, await vendor(doc));
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await post(doc, `/lab/cases/${id}/send`, { expectedReturnAt: past });
    const res = await needsYou(doc);
    expect(res.json().data.items.some((i: { kind: string }) => i.kind === 'LAB_OVERDUE')).toBe(true);
  });

  it('includes a low-stock item with an /inventory href and no patient', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc, 5);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 2, pricePerUnitPaise: 100 }); // 2 < 5
    const res = await needsYou(doc);
    const low = res.json().data.items.find((i: { kind: string }) => i.kind === 'LOW_STOCK');
    expect(low).toBeTruthy();
    expect(low.href).toBe(`/inventory/${id}`);
    expect(low.patientId ?? null).toBeNull();
  });
});

describe('Receptionist activity feed cross-wires', () => {
  it('includes a lab "sent" event', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const id = await labCase(doc, patientId, await vendor(doc));
    await post(doc, `/lab/cases/${id}/send`);
    const res = await app.inject({ method: 'GET', url: '/today/activity', headers: authHeader(doc.accessToken) });
    expect(res.json().data.items.some((i: { text: string }) => /sent case/i.test(i.text))).toBe(true);
  });

  it('includes an inventory purchase event', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 10, pricePerUnitPaise: 100 });
    const res = await app.inject({ method: 'GET', url: '/today/activity', headers: authHeader(doc.accessToken) });
    expect(res.json().data.items.some((i: { text: string }) => /to inventory/i.test(i.text))).toBe(true);
  });
});

describe('Patient detail Cases tab cross-wire', () => {
  it('lists a patient’s lab cases via the patientId filter', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const id = await labCase(doc, patientId, await vendor(doc));
    const res = await app.inject({ method: 'GET', url: `/lab/cases?patientId=${patientId}`, headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.items.map((c: { id: string }) => c.id);
    expect(ids).toEqual([id]);
  });
});
