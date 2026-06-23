import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { decryptField } from '../src/lib/encryption.js';
import { runAsSystem } from '../src/lib/request-context.js';
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

async function newDoctorWithClinic(over = {}) {
  const session = await signIn(app);
  phones.push(session.phone);
  const res = await app.inject({
    method: 'POST',
    url: '/clinics',
    headers: authHeader(session.accessToken),
    payload: sampleClinicInput(over),
  });
  if (res.statusCode === 200) clinicIds.push(res.json().data.clinic.id);
  return { session, res };
}

describe('POST /clinics', () => {
  it('creates a clinic with the caller as ADMIN + DOCTOR and a join code', async () => {
    const { res } = await newDoctorWithClinic();
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.joinCode).toMatch(/^[A-Z]{5}\d$/);
    expect(data.membership.role).toBe('DOCTOR');
    expect(data.membership.isAdmin).toBe(true);
    expect(data.membership.hasRegistrationNumber).toBe(true);
    // The encrypted reg number must never appear in the response.
    expect(JSON.stringify(data)).not.toContain('KA-DENT-99999');
  });

  it('stores the registration number encrypted (opaque base64, decryptable)', async () => {
    const { res } = await newDoctorWithClinic();
    const userId = res.json().data.membership.userId;
    const member = await runAsSystem(async () => {
      return await app.prisma.clinicMember.findFirst({ where: { userId } });
    });
    expect(member?.registrationNumberEnc).toBeTruthy();
    expect(member!.registrationNumberEnc).not.toContain('KA-DENT-99999');
    expect(decryptField(member!.registrationNumberEnc!)).toBe('KA-DENT-99999');
  });

  it('auto-generates one room per chair', async () => {
    const { res } = await newDoctorWithClinic({ chairsCount: 3 });
    const clinicId = res.json().data.clinic.id;
    const rooms = await runAsSystem(async () => {
      return await app.prisma.room.findMany({ where: { clinicId } });
    });
    expect(rooms.length).toBe(3);
  });

  it('rejects a caller who already belongs to a clinic', async () => {
    const session = await signIn(app);
    phones.push(session.phone);
    const first = await app.inject({
      method: 'POST',
      url: '/clinics',
      headers: authHeader(session.accessToken),
      payload: sampleClinicInput(),
    });
    clinicIds.push(first.json().data.clinic.id);
    const second = await app.inject({
      method: 'POST',
      url: '/clinics',
      headers: authHeader(session.accessToken),
      payload: sampleClinicInput(),
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('ALREADY_IN_CLINIC');
  });
});

describe('GET /clinics/lookup', () => {
  it('returns minimal clinic info for a valid code', async () => {
    const { res } = await newDoctorWithClinic();
    const joinCode = res.json().data.joinCode;
    const lookup = await app.inject({ method: 'GET', url: `/clinics/lookup?joinCode=${joinCode}` });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().data).toEqual({
      name: 'Smile Dental Care',
      city: 'Bengaluru',
      state: 'Karnataka',
    });
    // No full address is leaked.
    expect(JSON.stringify(lookup.json())).not.toContain('MG Road');
  });

  it('is case-insensitive on the join code', async () => {
    const { res } = await newDoctorWithClinic();
    const joinCode = res.json().data.joinCode.toLowerCase();
    const lookup = await app.inject({ method: 'GET', url: `/clinics/lookup?joinCode=${joinCode}` });
    expect(lookup.statusCode).toBe(200);
  });

  it('404s for an unknown code', async () => {
    const lookup = await app.inject({ method: 'GET', url: '/clinics/lookup?joinCode=NOPE9' });
    expect(lookup.statusCode).toBe(404);
  });
});

describe('POST /clinics/join', () => {
  it('lets a receptionist join without doctor fields', async () => {
    const { res } = await newDoctorWithClinic();
    const joinCode = res.json().data.joinCode;

    const session = await signIn(app);
    phones.push(session.phone);
    const join = await app.inject({
      method: 'POST',
      url: '/clinics/join',
      headers: authHeader(session.accessToken),
      payload: { joinCode, name: 'Ravi Kumar', role: 'RECEPTIONIST' },
    });
    expect(join.statusCode).toBe(200);
    expect(join.json().data.membership.role).toBe('RECEPTIONIST');
    expect(join.json().data.membership.isAdmin).toBe(false);
  });

  it('requires qualification + registration for a doctor join, and encrypts it', async () => {
    const { res } = await newDoctorWithClinic();
    const joinCode = res.json().data.joinCode;

    // Missing doctor fields → validation error.
    const bad = await signIn(app);
    phones.push(bad.phone);
    const missing = await app.inject({
      method: 'POST',
      url: '/clinics/join',
      headers: authHeader(bad.accessToken),
      payload: { joinCode, name: 'Dr. New', role: 'DOCTOR' },
    });
    expect(missing.statusCode).toBe(400);

    // With fields → success + encrypted reg number.
    const ok = await signIn(app);
    phones.push(ok.phone);
    const join = await app.inject({
      method: 'POST',
      url: '/clinics/join',
      headers: authHeader(ok.accessToken),
      payload: {
        joinCode,
        name: 'Dr. New',
        role: 'DOCTOR',
        qualification: 'BDS',
        registrationNumber: 'TN-DENT-22222',
      },
    });
    expect(join.statusCode).toBe(200);
    const member = await runAsSystem(async () => {
      return await app.prisma.clinicMember.findFirst({ where: { userId: ok.userId } });
    });
    expect(decryptField(member!.registrationNumberEnc!)).toBe('TN-DENT-22222');
  });

  it('404s for an unknown join code', async () => {
    const session = await signIn(app);
    phones.push(session.phone);
    const join = await app.inject({
      method: 'POST',
      url: '/clinics/join',
      headers: authHeader(session.accessToken),
      payload: { joinCode: 'ZZZZZ9', name: 'Xavier', role: 'RECEPTIONIST' },
    });
    expect(join.statusCode).toBe(404);
  });
});
