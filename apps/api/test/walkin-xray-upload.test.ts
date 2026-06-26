import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, findQueueEvent, joinReceptionist } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('receptionist attaches an x-ray during walk-in check-in', () => {
  it('creates a Media row linked to the new visit with type XRAY', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    // 1. Walk-in → a WAITING visit.
    const walkRes = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recp.accessToken),
      payload: { patientId, doctorId: doctor.userId, chiefComplaint: 'Brought prior x-rays' },
    });
    expect(walkRes.statusCode).toBe(200);
    const visitId = walkRes.json().data.id;
    expect(await findQueueEvent(app, doctor.clinicId, { visitId, type: 'CHECKED_IN' })).toBeTruthy();

    // 2. Presign + create the Media row, linked to the visit (the web does the PUT in between).
    const presign = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(recp.accessToken),
      payload: { filename: 'pano.png', mimeType: 'image/png', sizeBytes: 2048, patientId },
    });
    expect(presign.statusCode).toBe(200);
    const { storageKey } = presign.json().data;

    const mediaRes = await app.inject({
      method: 'POST',
      url: '/media',
      headers: authHeader(recp.accessToken),
      payload: { patientId, visitId, storageKey, type: 'XRAY', mimeType: 'image/png', sizeBytes: 2048 },
    });
    expect(mediaRes.statusCode).toBe(200);

    const media = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      const m = await app.prisma.media.findFirst({ where: { visitId, type: 'XRAY' } });
      return m;
    });
    expect(media).toBeTruthy();
    expect(media?.visitId).toBe(visitId);
    expect(media?.type).toBe('XRAY');
  });

  it('rejects an unsupported x-ray file type at presign', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const res = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(recp.accessToken),
      payload: { filename: 'bad.exe', mimeType: 'application/octet-stream', sizeBytes: 10, patientId },
    });
    expect(res.statusCode).toBe(400);
  });
});
