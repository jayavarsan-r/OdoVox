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

describe('GET /activity', () => {
  it('returns recent queue events with human-readable copy', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    // Generate a couple of events.
    await app.inject({ method: 'POST', url: `/visits/${visit.id}/call-in`, headers: authHeader(doctor.accessToken), payload: {} });

    const res = await app.inject({ method: 'GET', url: '/activity', headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(200);
    const { items } = res.json().data;
    expect(items.length).toBeGreaterThan(0);
    const called = items.find((i: { type: string }) => i.type === 'CALLED_IN');
    expect(called).toBeTruthy();
    expect(called.text).toMatch(/called/i);
    expect(called.patientName).toBeTruthy();
    expect(items.length).toBeLessThanOrEqual(50);
  });

  it('only returns events for the caller’s clinic', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const recpA = await joinReceptionist(app, clinicA.joinCode);
    const clinicB = await createDoctorWithClinic(app);
    const pB = await createPatient(app, clinicB.clinicId, clinicB.userId);
    const vB = await createVisit(app, clinicB.clinicId, { patientId: pB, doctorId: clinicB.userId, status: 'WAITING' });
    await app.inject({ method: 'POST', url: `/visits/${vB.id}/call-in`, headers: authHeader(clinicB.accessToken), payload: {} });

    const res = await app.inject({ method: 'GET', url: '/activity', headers: authHeader(recpA.accessToken) });
    const visitIds = res.json().data.items.map((i: { visitId: string }) => i.visitId);
    expect(visitIds).not.toContain(vB.id);
  });
});
