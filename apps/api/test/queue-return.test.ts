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

describe('POST /visits/:id/return-to-queue', () => {
  it('moves IN_CHAIR back to WAITING, frees the room, and keeps the reason', async () => {
    const doctor = await createDoctorWithClinic(app);
    const roomId = await createRoom(app, doctor.clinicId, { status: 'OCCUPIED' });
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, {
      patientId,
      doctorId: doctor.userId,
      status: 'IN_CHAIR',
      roomId,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/return-to-queue`,
      headers: authHeader(doctor.accessToken),
      payload: { reason: 'Need x-ray' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('WAITING');

    const reloaded = await reloadVisit(app, doctor.clinicId, visit.id);
    expect(reloaded?.status).toBe('WAITING');
    expect(reloaded?.calledInAt).toBeNull();
    expect(reloaded?.roomId).toBeNull();

    const room = await reloadRoom(app, doctor.clinicId, roomId);
    expect(room?.status).toBe('AVAILABLE');

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'RETURNED_TO_QUEUE' });
    expect((ev?.metadata as { reason?: string })?.reason).toBe('Need x-ray');
  });
});
