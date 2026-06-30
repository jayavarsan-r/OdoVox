import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';

let app: FastifyInstance;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  url = await listenApp(app);
});
afterAll(async () => {
  for (const c of clients) c.close();
  await app.close();
});

describe('Lab case broadcasts (REST → WS, after commit)', () => {
  it('create broadcasts lab.case.created and a transition broadcasts lab.case.updated', async () => {
    const doc = await createDoctorWithClinic(app);
    const vendor = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(doc.accessToken),
      payload: { name: 'Lab Co', contactPhone: '9840033333', defaultTurnaroundDays: 7, specialties: [] },
    });
    const patientId = await createPatient(app, doc.clinicId, doc.userId);

    const sock = await connectClient(url, doc.accessToken);
    clients.push(sock);
    const events = collect(sock);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    const created = await app.inject({
      method: 'POST',
      url: '/lab/cases',
      headers: authHeader(doc.accessToken),
      payload: { patientId, vendorId: vendor.json().data.id, type: 'CROWN', teeth: [26] },
    });
    expect(created.statusCode).toBe(201);
    const caseId = created.json().data.id;

    const createdEvt = await events.waitFor((e) => e.type === 'lab.case.created');
    expect(createdEvt.type).toBe('lab.case.created');
    if (createdEvt.type === 'lab.case.created') {
      expect(createdEvt.payload.id).toBe(caseId);
      expect(createdEvt.payload.status).toBe('DRAFT');
    }

    await app.inject({ method: 'POST', url: `/lab/cases/${caseId}/send`, headers: authHeader(doc.accessToken), payload: {} });
    const updatedEvt = await events.waitFor((e) => e.type === 'lab.case.updated');
    if (updatedEvt.type === 'lab.case.updated') {
      expect(updatedEvt.payload.id).toBe(caseId);
      expect(updatedEvt.payload.status).toBe('SENT');
    }
  });
});
