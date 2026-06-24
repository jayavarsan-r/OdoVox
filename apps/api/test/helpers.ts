import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { ClinicCreateInput } from '@odovox/types';
import type { ClinicJoinInput } from '@odovox/types';
import { runWithContext } from '../src/lib/request-context.js';

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

export interface ClinicSetup {
  accessToken: string; // clinic-scoped
  userId: string;
  phone: string;
  clinicId: string;
  joinCode: string;
}

/** Sign up a doctor and create a clinic; returns a clinic-scoped access token. */
export async function createDoctorWithClinic(
  app: FastifyInstance,
  over: Partial<ClinicCreateInput> = {},
): Promise<ClinicSetup> {
  const session = await signIn(app);
  const res = await app.inject({
    method: 'POST',
    url: '/clinics',
    headers: authHeader(session.accessToken),
    payload: sampleClinicInput(over),
  });
  if (res.statusCode !== 200) throw new Error(`create clinic failed: ${res.statusCode} ${res.body}`);
  const data = res.json().data;
  return {
    accessToken: data.accessToken,
    userId: session.userId,
    phone: session.phone,
    clinicId: data.clinic.id,
    joinCode: data.joinCode,
  };
}

/** Sign up a receptionist and join an existing clinic; returns a clinic-scoped token. */
export async function joinReceptionist(
  app: FastifyInstance,
  joinCode: string,
): Promise<{ accessToken: string; userId: string; phone: string }> {
  const session = await signIn(app);
  const res = await app.inject({
    method: 'POST',
    url: '/clinics/join',
    headers: authHeader(session.accessToken),
    payload: { joinCode, name: 'Ravi Kumar', role: 'RECEPTIONIST' },
  });
  if (res.statusCode !== 200) throw new Error(`join failed: ${res.statusCode} ${res.body}`);
  return { accessToken: res.json().data.accessToken, userId: session.userId, phone: session.phone };
}

/** Sign up a second doctor and join an existing clinic; returns a clinic-scoped token. */
export async function joinDoctor(
  app: FastifyInstance,
  joinCode: string,
  name = 'Dr. Vikram Rao',
): Promise<{ accessToken: string; userId: string; phone: string }> {
  const session = await signIn(app);
  const res = await app.inject({
    method: 'POST',
    url: '/clinics/join',
    headers: authHeader(session.accessToken),
    payload: {
      joinCode,
      name,
      role: 'DOCTOR',
      qualification: 'BDS',
      registrationNumber: `KA-DENT-${Math.floor(Math.random() * 1e6)}`,
      specialization: ['General'],
    },
  });
  if (res.statusCode !== 200) throw new Error(`doctor join failed: ${res.statusCode} ${res.body}`);
  return { accessToken: res.json().data.accessToken, userId: session.userId, phone: session.phone };
}

export interface SeededVisit {
  id: string;
  patientId: string;
  lifecycleVersion: number;
  status: string;
  tokenNumber: number;
}

/** Create a visit in a given queue state for a patient assigned to a doctor (clinic-scoped). */
export async function createVisit(
  app: FastifyInstance,
  clinicId: string,
  opts: {
    patientId: string;
    doctorId: string;
    assignedDoctorId?: string | null;
    status?: 'SCHEDULED' | 'CHECKED_IN' | 'WAITING' | 'IN_CHAIR' | 'CHECKOUT';
    priority?: number;
    roomId?: string | null;
  },
): Promise<SeededVisit> {
  return runWithContext({ clinicId, userId: opts.doctorId }, async () => {
    const status = opts.status ?? 'WAITING';
    const now = new Date();
    const count = await app.prisma.visit.count({});
    const v = await app.prisma.visit.create({
      data: {
        clinicId,
        patientId: opts.patientId,
        doctorId: opts.doctorId,
        assignedDoctorId: opts.assignedDoctorId === undefined ? opts.doctorId : opts.assignedDoctorId,
        roomId: opts.roomId ?? null,
        status,
        tokenNumber: count + 1,
        priority: opts.priority ?? 0,
        checkedInAt: status === 'SCHEDULED' ? null : now,
        calledInAt: status === 'IN_CHAIR' || status === 'CHECKOUT' ? now : null,
        startedAt: status === 'IN_CHAIR' ? now : null,
      },
    });
    return { id: v.id, patientId: v.patientId, lifecycleVersion: v.lifecycleVersion, status: v.status, tokenNumber: v.tokenNumber };
  });
}

/**
 * Read a clinic-scoped model inside the right context. NOTE: the read must be AWAITED *inside* the
 * `runWithContext` callback — a bare `() => prisma.x.findFirst()` returns a lazy PrismaPromise that
 * runs after the context has exited, so the scope middleware would see no clinicId.
 */
export function reloadVisit(app: FastifyInstance, clinicId: string, id: string) {
  return runWithContext({ clinicId }, async () => {
    const v = await app.prisma.visit.findFirst({ where: { id } });
    return v;
  });
}

export function findQueueEvent(
  app: FastifyInstance,
  clinicId: string,
  where: { visitId?: string; type?: string },
) {
  return runWithContext({ clinicId }, async () => {
    const ev = await app.prisma.queueEvent.findFirst({ where, orderBy: { createdAt: 'desc' } });
    return ev;
  });
}

export function reloadRoom(app: FastifyInstance, clinicId: string, id: string) {
  return runWithContext({ clinicId }, async () => {
    const r = await app.prisma.room.findFirst({ where: { id } });
    return r;
  });
}

/** Create a room in a clinic (clinic-scoped). */
export async function createRoom(
  app: FastifyInstance,
  clinicId: string,
  over: { name?: string; number?: string; status?: 'AVAILABLE' | 'OCCUPIED' | 'OFFLINE' } = {},
): Promise<string> {
  return runWithContext({ clinicId, system: false }, async () => {
    const r = await app.prisma.room.create({
      data: {
        clinicId,
        name: over.name ?? 'Room A',
        number: over.number ?? String(Math.floor(Math.random() * 90) + 10),
        status: over.status ?? 'AVAILABLE',
      },
    });
    return r.id;
  });
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

export interface SeededConsultation {
  patientId: string;
  visitId: string;
  consultationId: string;
}

/**
 * Create a patient + in-chair visit + PENDING_REVIEW consultation directly via Prisma, inside a
 * clinic-scoped context (Visit/Patient are scoped models). Used by confirm/pipeline tests.
 */
export async function seedConsultation(
  app: FastifyInstance,
  clinicId: string,
  doctorId: string,
  structuredData: object,
  over: { allergiesEnc?: string | null; medicalFlags?: string[]; age?: number } = {},
): Promise<SeededConsultation> {
  return runWithContext({ clinicId, userId: doctorId }, async () => {
    const patient = await app.prisma.patient.create({
      data: {
        clinicId,
        patientCode: `PT-T${Math.floor(Math.random() * 1e9)}`,
        name: 'Test Patient',
        phone: randomPhone(),
        age: over.age ?? 30,
        gender: 'MALE',
        allergiesEnc: over.allergiesEnc ?? null,
        medicalFlags: over.medicalFlags ?? [],
        status: 'ACTIVE',
        createdById: doctorId,
      },
    });
    const visit = await app.prisma.visit.create({
      data: { clinicId, patientId: patient.id, doctorId, status: 'IN_CHAIR', tokenNumber: 1 },
    });
    const consultation = await app.prisma.consultation.create({
      data: { visitId: visit.id, status: 'PENDING_REVIEW', structuredData: structuredData as object },
    });
    return { patientId: patient.id, visitId: visit.id, consultationId: consultation.id };
  });
}

/** Create a bare patient (in a clinic-scoped context) and return its id. */
export async function createPatient(
  app: FastifyInstance,
  clinicId: string,
  doctorId: string,
  over: { allergiesEnc?: string | null; medicalFlags?: string[]; age?: number } = {},
): Promise<string> {
  return runWithContext({ clinicId, userId: doctorId }, async () => {
    const p = await app.prisma.patient.create({
      data: {
        clinicId,
        patientCode: `PT-D${Math.floor(Math.random() * 1e9)}`,
        name: 'Rx Patient',
        phone: randomPhone(),
        age: over.age ?? 30,
        gender: 'MALE',
        allergiesEnc: over.allergiesEnc ?? null,
        medicalFlags: over.medicalFlags ?? [],
        status: 'ACTIVE',
        createdById: doctorId,
      },
    });
    return p.id;
  });
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
