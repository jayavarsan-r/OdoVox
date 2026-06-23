import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { ClinicCreateInput } from '@odovox/types';
import type { ClinicJoinInput } from '@odovox/types';

/** Build a real server wired to the dev Postgres/Redis (see docker-compose). */
export async function buildTestApp(): Promise<FastifyInstance> {
  return buildServer();
}

/** A unique, valid Indian mobile per call so tests never collide on phone-scoped state. */
export function randomPhone(): string {
  let tail = '';
  for (let i = 0; i < 9; i++) tail += Math.floor(Math.random() * 10);
  return `9${tail}`;
}

/** A unique fake client IP — req.ip honours X-Forwarded-For (trustProxy=true). */
export function randomIp(): string {
  return `10.${rand(255)}.${rand(255)}.${rand(254) + 1}`;
}

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

export interface SignInResult {
  accessToken: string;
  refreshCookie: string;
  userId: string;
  phone: string;
  nextStep: string;
}

/** Drive the full OTP request → verify flow and return tokens. */
export async function signIn(
  app: FastifyInstance,
  phone = randomPhone(),
  ip = randomIp(),
): Promise<SignInResult> {
  const reqRes = await app.inject({
    method: 'POST',
    url: '/auth/otp/request',
    headers: { 'x-forwarded-for': ip },
    payload: { phone },
  });
  if (reqRes.statusCode !== 200) {
    throw new Error(`otp/request failed: ${reqRes.statusCode} ${reqRes.body}`);
  }

  const verifyRes = await app.inject({
    method: 'POST',
    url: '/auth/otp/verify',
    headers: { 'x-forwarded-for': ip },
    payload: { phone, otp: '123456' },
  });
  if (verifyRes.statusCode !== 200) {
    throw new Error(`otp/verify failed: ${verifyRes.statusCode} ${verifyRes.body}`);
  }
  const body = verifyRes.json().data;
  const cookie = verifyRes.cookies.find((c) => c.name === 'odovox_rt');
  return {
    accessToken: body.accessToken,
    refreshCookie: cookie ? `${cookie.name}=${cookie.value}` : '',
    userId: body.user.id,
    phone,
    nextStep: body.nextStep,
  };
}

export function authHeader(token: string, ip = randomIp()): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'x-forwarded-for': ip };
}

export function sampleClinicInput(over: Partial<ClinicCreateInput> = {}): ClinicCreateInput {
  return ClinicCreateInput.parse({
    name: 'Smile Dental Care',
    addressLine: '12 MG Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    contactPhone: '8000000000',
    openingTime: '09:00',
    closingTime: '18:00',
    weeklyOffDays: [0],
    chairsCount: 2,
    doctorName: 'Dr. Asha Menon',
    qualification: 'BDS, MDS',
    registrationNumber: 'KA-DENT-99999',
    specialization: ['Endodontics'],
    ...over,
  });
}

export function sampleJoinInput(joinCode: string, over: Partial<ClinicJoinInput> = {}) {
  return {
    joinCode,
    name: 'Ravi Kumar',
    role: 'RECEPTIONIST' as const,
    ...over,
  };
}

/** Best-effort teardown of rows created by a test. */
export async function cleanup(
  app: FastifyInstance,
  opts: { phones?: string[]; clinicIds?: string[] },
): Promise<void> {
  for (const id of opts.clinicIds ?? []) {
    await app.prisma.clinic.delete({ where: { id } }).catch(() => undefined);
  }
  for (const phone of opts.phones ?? []) {
    await app.prisma.user.delete({ where: { phone } }).catch(() => undefined);
    await app.prisma.otpRequest.deleteMany({ where: { phone } }).catch(() => undefined);
  }
}
