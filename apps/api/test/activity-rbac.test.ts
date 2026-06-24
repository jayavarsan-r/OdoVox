import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('GET /activity RBAC', () => {
  it('forbids a doctor from reading the receptionist activity feed (403 + audit)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const res = await app.inject({ method: 'GET', url: '/activity', headers: authHeader(doctor.accessToken) });
    expect(res.statusCode).toBe(403);

    const denied = await app.prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', clinicId: doctor.clinicId },
      orderBy: { createdAt: 'desc' },
    });
    expect(denied).toBeTruthy();
  });
});
