import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  cleanup,
  sampleClinicInput,
  signIn,
} from './helpers.js';

let app: FastifyInstance;
const phones: string[] = [];
const clinicIds: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

async function actionsFor(userId: string): Promise<string[]> {
  const rows = await app.prisma.auditLog.findMany({ where: { userId } });
  return rows.map((r) => r.action);
}

describe('Auth audit trail', () => {
  it('logs OTP_VERIFIED and USER_CREATED (attributed) plus an OTP_REQUESTED row', async () => {
    const before = await app.prisma.auditLog.count({ where: { action: 'OTP_REQUESTED' } });
    const session = await signIn(app);
    phones.push(session.phone);

    // OTP_VERIFIED / USER_CREATED are attributed to the user (set during verify).
    const actions = await actionsFor(session.userId);
    expect(actions).toEqual(expect.arrayContaining(['OTP_VERIFIED', 'USER_CREATED']));

    // OTP_REQUESTED is logged before the user exists, so it carries the masked phone,
    // not a userId. Assert a new row was written.
    const after = await app.prisma.auditLog.count({ where: { action: 'OTP_REQUESTED' } });
    expect(after).toBeGreaterThan(before);
  });

  it('logs CLINIC_CREATED and CLINIC_MEMBER_ADDED for clinic creation', async () => {
    const session = await signIn(app);
    phones.push(session.phone);
    const res = await app.inject({
      method: 'POST',
      url: '/clinics',
      headers: authHeader(session.accessToken),
      payload: sampleClinicInput(),
    });
    clinicIds.push(res.json().data.clinic.id);

    const actions = await actionsFor(session.userId);
    expect(actions).toEqual(
      expect.arrayContaining(['CLINIC_CREATED', 'CLINIC_MEMBER_ADDED', 'USER_PROFILE_UPDATED']),
    );
  });

  it('logs CLINIC_MEMBER_JOINED for a receptionist and USER_LOGGED_OUT on logout', async () => {
    const doctor = await signIn(app);
    phones.push(doctor.phone);
    const created = await app.inject({
      method: 'POST',
      url: '/clinics',
      headers: authHeader(doctor.accessToken),
      payload: sampleClinicInput(),
    });
    const joinCode = created.json().data.joinCode;
    clinicIds.push(created.json().data.clinic.id);

    const recept = await signIn(app);
    phones.push(recept.phone);
    await app.inject({
      method: 'POST',
      url: '/clinics/join',
      headers: authHeader(recept.accessToken),
      payload: { joinCode, name: 'Ravi Kumar', role: 'RECEPTIONIST' },
    });
    await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: recept.refreshCookie },
    });

    const actions = await actionsFor(recept.userId);
    expect(actions).toEqual(expect.arrayContaining(['CLINIC_MEMBER_JOINED', 'USER_LOGGED_OUT']));
  });
});
