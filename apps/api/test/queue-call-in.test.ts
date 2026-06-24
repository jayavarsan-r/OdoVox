import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createRoom,
  createVisit,
  findQueueEvent,
  reloadRoom,
  reloadVisit,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /visits/:id/call-in', () => {
  it('moves a WAITING patient to IN_CHAIR and assigns the first available room', async () => {
    const doctor = await createDoctorWithClinic(app); // clinic auto-creates rooms per chair
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const { visit: called, autoCheckedOut } = res.json().data;
    expect(called.status).toBe('IN_CHAIR');
    expect(called.roomId).toBeTruthy(); // auto-picked the first AVAILABLE room
    expect(called.roomName).toBeTruthy();
    expect(called.calledInAt).toBeTruthy();
    expect(autoCheckedOut).toBeNull();

    const room = await reloadRoom(app, doctor.clinicId, called.roomId);
    expect(room?.status).toBe('OCCUPIED');

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'CALLED_IN' });
    expect(ev).toBeTruthy();
  });

  it('auto-moves the doctor’s previous IN_CHAIR patient to CHECKOUT', async () => {
    const doctor = await createDoctorWithClinic(app);
    await createRoom(app, doctor.clinicId, { number: '1' });
    const prevPatient = await createPatient(app, doctor.clinicId, doctor.userId);
    const nextPatient = await createPatient(app, doctor.clinicId, doctor.userId);
    const prevVisit = await createVisit(app, doctor.clinicId, { patientId: prevPatient, doctorId: doctor.userId, status: 'IN_CHAIR' });
    const nextVisit = await createVisit(app, doctor.clinicId, { patientId: nextPatient, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${nextVisit.id}/call-in`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const { visit: called, autoCheckedOut } = res.json().data;
    expect(called.status).toBe('IN_CHAIR');
    expect(autoCheckedOut).not.toBeNull();
    expect(autoCheckedOut.id).toBe(prevVisit.id);
    expect(autoCheckedOut.status).toBe('CHECKOUT');

    const reloadedPrev = await reloadVisit(app, doctor.clinicId, prevVisit.id);
    expect(reloadedPrev?.status).toBe('CHECKOUT');
    expect(reloadedPrev?.checkoutStartedAt).toBeTruthy();
  });
});
