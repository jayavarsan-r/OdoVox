import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  createPatient,
  futureWeekdayISO,
  joinReceptionist,
  seedDoctorAvailability,
} from './helpers.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import { runWithContext } from '../src/lib/request-context.js';

const scoped = <T>(clinicId: string, fn: () => Promise<T>) => runWithContext({ clinicId }, async () => await fn());

const TZ = 'Asia/Kolkata';
const at = (hhmm: string, dateISO: string) => localDateTimeToUtc(dateISO, hhmm, TZ);

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

async function setup() {
  const c = await createDoctorWithClinic(app);
  phones.push(c.phone);
  clinicIds.push(c.clinicId);
  await seedDoctorAvailability(app, c.clinicId, c.userId);
  const patientId = await createPatient(app, c.clinicId, c.userId);
  return { ...c, doctorId: c.userId, patientId };
}

describe('GET /schedule/slots', () => {
  it('returns available slots for a doctor with availability', async () => {
    const s = await setup();
    const date = futureWeekdayISO(14);
    const res = await app.inject({
      method: 'GET',
      url: `/schedule/slots?date=${date}&doctorId=${s.doctorId}&durationMinutes=30`,
      headers: authHeader(s.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.slots.length).toBeGreaterThan(0);
  });
});

describe('GET /schedule', () => {
  it('returns the caller doctor’s appointments for the date range', async () => {
    const s = await setup();
    const date = futureWeekdayISO(14);
    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeader(s.accessToken),
      payload: { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00', date).toISOString(), durationMinutes: 30 },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/schedule?from=${date}&to=${date}&doctorId=me&view=day`,
      headers: authHeader(s.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.appointments.length).toBeGreaterThanOrEqual(1);
    expect(data.clinicHours.timezone).toBe(TZ);
  });
});

describe('availability CRUD + RBAC', () => {
  it('forbids a receptionist from setting availability (403)', async () => {
    const s = await setup();
    const recep = await joinReceptionist(app, s.joinCode);
    phones.push(recep.phone);
    const res = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${s.doctorId}`,
      headers: authHeader(recep.accessToken),
      payload: { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('lets a doctor set their own availability (201)', async () => {
    const c = await createDoctorWithClinic(app);
    phones.push(c.phone);
    clinicIds.push(c.clinicId);
    const res = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${c.userId}`,
      headers: authHeader(c.accessToken),
      payload: { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.availability.dayOfWeek).toBe(2);
  });

  it('editing availability does NOT cascade-cancel existing appointments', async () => {
    const s = await setup();
    const date = futureWeekdayISO(14);
    const apptId = await app
      .inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeader(s.accessToken),
        payload: { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00', date).toISOString(), durationMinutes: 30 },
      })
      .then((r) => r.json().data.appointment.id);

    const row = await scoped(s.clinicId, () => app.prisma.doctorAvailability.findFirst({ where: { clinicId: s.clinicId, doctorId: s.doctorId } }));
    const res = await app.inject({
      method: 'PATCH',
      url: `/availability/${row!.id}`,
      headers: authHeader(s.accessToken),
      payload: { startTime: '14:00', endTime: '18:00' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveProperty('affectedAppointmentCount');
    const appt = await scoped(s.clinicId, () => app.prisma.appointment.findFirst({ where: { id: apptId } }));
    expect(appt!.status).toBe('SCHEDULED'); // not cancelled
  });
});

describe('day-off CRUD', () => {
  it('admin creates a clinic day-off and it blocks slot generation', async () => {
    const s = await setup();
    const date = futureWeekdayISO(21);
    const created = await app.inject({
      method: 'POST',
      url: '/day-off',
      headers: authHeader(s.accessToken),
      payload: { date: at('00:00', date).toISOString(), scope: 'CLINIC', reason: 'Holiday' },
    });
    expect(created.statusCode).toBe(201);
    const slots = await app.inject({
      method: 'GET',
      url: `/schedule/slots?date=${date}&doctorId=${s.doctorId}&durationMinutes=30`,
      headers: authHeader(s.accessToken),
    });
    expect(slots.json().data.slots).toHaveLength(0);
  });

  it('refuses to create a day-off when appointments exist in the range (409)', async () => {
    const s = await setup();
    const date = futureWeekdayISO(28);
    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeader(s.accessToken),
      payload: { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00', date).toISOString(), durationMinutes: 30 },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/day-off',
      headers: authHeader(s.accessToken),
      payload: { date: at('00:00', date).toISOString(), scope: 'CLINIC' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('DAY_OFF_HAS_APPOINTMENTS');
    expect(res.json().error.details.appointments.length).toBeGreaterThan(0);
  });
});
