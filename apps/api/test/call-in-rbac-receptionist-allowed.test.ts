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

/**
 * Phase 9.6 Issue 1: calling patients in is the receptionist's core job. The Phase 4 matrix
 * (call-in = doctor-only) was wrong in the real clinic — the receptionist announces the patient
 * and walks them to the chair for whichever doctor is next.
 */
describe('call-in RBAC — receptionist allowed', () => {
  it('a receptionist can call in a waiting patient (200, IN_CHAIR)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, {
      patientId,
      doctorId: doctor.userId,
      status: 'WAITING',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const { visit: called } = res.json().data;
    expect(called.status).toBe('IN_CHAIR');
    // The visit stays with its assigned doctor — the receptionist never claims the chair.
    expect(called.assignedDoctorId ?? called.doctorId).toBe(doctor.userId);
  });

  it('a receptionist can call in for ANY doctor in the clinic (auto-checkout keys on the visit doctor)', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const recp = await joinReceptionist(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, {
      patientId,
      doctorId: doctorB.userId,
      status: 'WAITING',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.visit.status).toBe('IN_CHAIR');
  });
});
