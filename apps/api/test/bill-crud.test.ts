import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinReceptionist,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function setup() {
  const doctor = await createDoctorWithClinic(app); // clinic creator = admin
  const recp = await joinReceptionist(app, doctor.joinCode);
  const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
  return { doctor, recp, patientId };
}

const item = (over = {}) => ({ kind: 'PROCEDURE', description: 'RCT 26', unitPricePaise: 900000, ...over });

describe('Bill CRUD', () => {
  it('creates a DRAFT bill from a visit with server-computed totals', async () => {
    const { doctor, recp, patientId } = await setup();
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'CHECKOUT' });
    const res = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: authHeader(recp.accessToken),
      payload: { patientId, visitId: visit.id, items: [item()] },
    });
    expect(res.statusCode).toBe(201);
    const bill = res.json().data;
    expect(bill.status).toBe('DRAFT');
    expect(bill.billNumber).toMatch(/^BL-/);
    expect(bill.subtotalPaise).toBe(900000);
    expect(bill.totalPaise).toBe(900000);
    expect(bill.balancePaise).toBe(900000);
    expect(bill.items).toHaveLength(1);
  });

  it('edits a DRAFT bill (bill-level discount) and recomputes totals', async () => {
    const { recp, patientId } = await setup();
    const created = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: authHeader(recp.accessToken),
      payload: { patientId, items: [item()] },
    });
    const id = created.json().data.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/bills/${id}`,
      headers: authHeader(recp.accessToken),
      payload: { discountPaise: 100000, discountReason: 'Loyalty' },
    });
    expect(res.statusCode).toBe(200);
    const bill = res.json().data;
    expect(bill.discountPaise).toBe(100000);
    expect(bill.totalPaise).toBe(800000);
    expect(bill.balancePaise).toBe(800000);
  });

  it('adds then removes a line item, recomputing each time', async () => {
    const { recp, patientId } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [item()] },
    });
    const id = created.json().data.id;
    const add = await app.inject({
      method: 'POST', url: `/bills/${id}/items`, headers: authHeader(recp.accessToken),
      payload: { kind: 'MATERIAL', description: 'Gutta-percha', unitPricePaise: 50000, quantity: 2 },
    });
    expect(add.statusCode).toBe(201);
    expect(add.json().data.subtotalPaise).toBe(1000000); // 900000 + 2*50000
    const newItemId = add.json().data.items.find((i: { description: string }) => i.description === 'Gutta-percha').id;
    const del = await app.inject({
      method: 'DELETE', url: `/bills/${id}/items/${newItemId}`, headers: authHeader(recp.accessToken),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.subtotalPaise).toBe(900000);
  });

  it('finalizes a DRAFT bill, locking it and snapshotting the patient', async () => {
    const { recp, patientId } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [item()] },
    });
    const id = created.json().data.id;
    const res = await app.inject({ method: 'POST', url: `/bills/${id}/finalize`, headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(200);
    const bill = res.json().data;
    expect(bill.status).toBe('FINALIZED');
    expect(bill.finalizedAt).toBeTruthy();
    expect(bill.patientName).toBeTruthy();
  });

  it('cancels a finalized bill with no payments', async () => {
    const { recp, patientId } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [item()] },
    });
    const id = created.json().data.id;
    await app.inject({ method: 'POST', url: `/bills/${id}/finalize`, headers: authHeader(recp.accessToken) });
    const res = await app.inject({
      method: 'POST', url: `/bills/${id}/cancel`, headers: authHeader(recp.accessToken),
      payload: { reason: 'Duplicate bill' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CANCELLED');
    expect(res.json().data.cancelledReason).toBe('Duplicate bill');
  });

  it('reopens a finalized bill (admin only) and lists bills for the clinic', async () => {
    const { doctor, recp, patientId } = await setup();
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [item()] },
    });
    const id = created.json().data.id;
    await app.inject({ method: 'POST', url: `/bills/${id}/finalize`, headers: authHeader(recp.accessToken) });
    // admin doctor (clinic creator) reopens
    const reopen = await app.inject({
      method: 'POST', url: `/bills/${id}/reopen`, headers: authHeader(doctor.accessToken), payload: {},
    });
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json().data.status).toBe('DRAFT');

    const list = await app.inject({ method: 'GET', url: '/bills', headers: authHeader(recp.accessToken) });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items.some((b: { id: string }) => b.id === id)).toBe(true);
  });
});
