import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinReceptionist,
} from './helpers.js';
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

async function client(token: string) {
  const s = await connectClient(url, token);
  clients.push(s);
  return s;
}

describe('Socket.IO broadcasts (REST → WS)', () => {
  it('a REST check-in broadcasts queue.visit.checked_in to the clinic', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const docSocket = await client(doctor.accessToken);
    const events = collect(docSocket);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    const res = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId },
    });
    expect(res.statusCode).toBe(200);

    const evt = await events.waitFor((e) => e.type === 'queue.visit.checked_in');
    expect(evt.type).toBe('queue.visit.checked_in');
    if (evt.type === 'queue.visit.checked_in') {
      expect(evt.payload.patient.id).toBe(patientId);
      expect(evt.payload.status).toBe('WAITING');
    }
  });

  it('a rejected transition (409) does NOT broadcast — broadcasts fire only after commit', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    // Already IN_CHAIR → call-in is an illegal transition (no commit, no broadcast).
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'IN_CHAIR' });

    const docSocket = await client(doctor.accessToken);
    const events = collect(docSocket);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(409);

    await events.expectNone((e) => e.type === 'queue.visit.called_in');
  });

  it('two clients in the same clinic both receive the event', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const docSocket = await client(doctor.accessToken);
    const recpSocket = await client(recp.accessToken);
    const docEvents = collect(docSocket);
    const recpEvents = collect(recpSocket);
    await Promise.all([
      docEvents.waitFor((e) => e.type === 'queue.snapshot'),
      recpEvents.waitFor((e) => e.type === 'queue.snapshot'),
    ]);

    await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId },
    });

    const [a, b] = await Promise.all([
      docEvents.waitFor((e) => e.type === 'queue.visit.checked_in'),
      recpEvents.waitFor((e) => e.type === 'queue.visit.checked_in'),
    ]);
    expect(a.type).toBe('queue.visit.checked_in');
    expect(b.type).toBe('queue.visit.checked_in');
  });

  it('does NOT leak events across clinics', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const recpA = await joinReceptionist(app, clinicA.joinCode);
    const patientA = await createPatient(app, clinicA.clinicId, clinicA.userId);

    const aSocket = await client(clinicA.accessToken);
    const bSocket = await client(clinicB.accessToken);
    const aEvents = collect(aSocket);
    const bEvents = collect(bSocket);
    await Promise.all([
      aEvents.waitFor((e) => e.type === 'queue.snapshot'),
      bEvents.waitFor((e) => e.type === 'queue.snapshot'),
    ]);

    await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recpA.accessToken),
      payload: { patientId: patientA, doctorId: clinicA.userId },
    });

    // Clinic A sees it; clinic B must never receive a clinic-A event.
    await aEvents.waitFor((e) => e.type === 'queue.visit.checked_in');
    await bEvents.expectNone((e) => e.type === 'queue.visit.checked_in', 1000);
  });
});
