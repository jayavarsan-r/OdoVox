import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
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

/**
 * Phase 9.6 Issue 4/15: every walk-in path (voice or manual, existing or freshly created patient)
 * ends in POST /visits — the patient must land in the assigned doctor's queue as WAITING.
 */
describe('walk-in lands in the queue as WAITING', () => {
  it('receptionist creates a patient then a walk-in visit → WAITING in the doctor queue', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);

    // Voice-add new patient path: the sheet creates the patient first…
    const createRes = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(recp.accessToken),
      payload: { name: 'Walkin Kumar', phone: '9876512340', age: 35, gender: 'MALE' },
    });
    expect(createRes.statusCode).toBe(200);
    const patientId = createRes.json().data.id;

    // …then checks them in with visit details (doctor + complaint + priority).
    const visitRes = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId, chiefComplaint: 'tooth pain', priority: 0 },
    });
    expect(visitRes.statusCode).toBe(200);
    const visit = visitRes.json().data;
    expect(visit.status).toBe('WAITING');
    expect(visit.assignedDoctorId ?? visit.doctorId).toBe(doctor.userId);
    expect(visit.chiefComplaint).toBe('tooth pain');

    // The doctor's queue snapshot shows the patient waiting.
    const queueRes = await app.inject({
      method: 'GET',
      url: '/queue?doctor=all',
      headers: authHeader(recp.accessToken),
    });
    expect(queueRes.statusCode).toBe(200);
    const waiting = queueRes.json().data.visits.filter((v: { status: string }) => v.status === 'WAITING');
    expect(waiting.some((v: { patient: { name: string } }) => v.patient.name === 'Walkin Kumar')).toBe(true);
  });

  it('an existing patient can be checked in directly (voice-search path)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId, priority: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('WAITING');
    expect(res.json().data.priority).toBe(10);
  });
});
