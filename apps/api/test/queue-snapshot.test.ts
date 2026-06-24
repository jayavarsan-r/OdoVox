import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinDoctor,
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

describe('GET /queue', () => {
  it('returns the snapshot shape (visits + doctors + rooms + serverTime)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({ method: 'GET', url: '/queue', headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(200);
    const snap = res.json().data;
    expect(Array.isArray(snap.visits)).toBe(true);
    expect(Array.isArray(snap.doctors)).toBe(true);
    expect(Array.isArray(snap.rooms)).toBe(true);
    expect(snap.serverTime).toBeTruthy();
    const row = snap.visits.find((v: { patient: { id: string } }) => v.patient.id === patientId);
    expect(row).toBeTruthy();
    expect(row.patient.name).toBeTruthy();
    expect(row).toHaveProperty('lifecycleVersion');
  });

  it('?doctor=me filters to the calling doctor’s queue; ?doctor=all shows everyone', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const pa = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const pb = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const vA = await createVisit(app, doctorA.clinicId, { patientId: pa, doctorId: doctorA.userId, status: 'WAITING' });
    const vB = await createVisit(app, doctorA.clinicId, { patientId: pb, doctorId: doctorB.userId, status: 'WAITING' });

    const mine = await app.inject({ method: 'GET', url: '/queue?doctor=me', headers: authHeader(doctorA.accessToken) });
    const myIds = mine.json().data.visits.map((v: { id: string }) => v.id);
    expect(myIds).toContain(vA.id);
    expect(myIds).not.toContain(vB.id);

    const all = await app.inject({ method: 'GET', url: '/queue?doctor=all', headers: authHeader(doctorA.accessToken) });
    const allIds = all.json().data.visits.map((v: { id: string }) => v.id);
    expect(allIds).toContain(vA.id);
    expect(allIds).toContain(vB.id);
  });

  it('defaults a doctor to their own queue and a receptionist to all', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const otherDoc = await joinDoctor(app, doctor.joinCode);
    const p = await createPatient(app, doctor.clinicId, doctor.userId);
    const vOther = await createVisit(app, doctor.clinicId, { patientId: p, doctorId: otherDoc.userId, status: 'WAITING' });

    const docDefault = await app.inject({ method: 'GET', url: '/queue', headers: authHeader(doctor.accessToken) });
    expect(docDefault.json().data.visits.some((v: { id: string }) => v.id === vOther.id)).toBe(false);

    const recpDefault = await app.inject({ method: 'GET', url: '/queue', headers: authHeader(recp.accessToken) });
    expect(recpDefault.json().data.visits.some((v: { id: string }) => v.id === vOther.id)).toBe(true);
  });
});
