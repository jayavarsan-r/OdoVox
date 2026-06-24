import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  findQueueEvent,
  joinReceptionist,
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

describe('POST /visits — receptionist walk-in', () => {
  it('creates a WAITING visit assigned to the chosen doctor, with a CHECKED_IN queue event', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId, chiefComplaint: 'Toothache', priority: 0 },
    });
    expect(res.statusCode).toBe(200);
    const visit = res.json().data;
    expect(visit.status).toBe('WAITING');
    expect(visit.assignedDoctorId).toBe(doctor.userId);
    expect(visit.patient.id).toBe(patientId);
    expect(visit.checkedInAt).toBeTruthy();

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'CHECKED_IN' });
    expect(ev).toBeTruthy();
    expect(ev?.byUserId).toBe(recp.userId);

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'QUEUE_WALK_IN', entityId: visit.id },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects a walk-in assigned to a non-doctor', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: recp.userId }, // recp is not a doctor
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /visits/:id/check-in — scheduled patient arrives', () => {
  it('moves a SCHEDULED visit to WAITING', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, {
      patientId,
      doctorId: doctor.userId,
      status: 'SCHEDULED',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/check-in`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('WAITING');

    const reloaded = await reloadVisit(app, doctor.clinicId, visit.id);
    expect(reloaded?.status).toBe('WAITING');
    expect(reloaded?.lifecycleVersion).toBe(1);
    expect(reloaded?.checkedInAt).toBeTruthy();
  });
});
