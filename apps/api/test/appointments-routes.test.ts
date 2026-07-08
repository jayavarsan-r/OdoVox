import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServerEvent } from '@odovox/types';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  createPatient,
  createRoom,
  futureWeekdayISO,
  joinDoctor,
  seedDoctorAvailability,
} from './helpers.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import { setRealtimeEmitter } from '../src/lib/realtime/broadcast.js';
import { runWithContext } from '../src/lib/request-context.js';

/** Read clinic-scoped models inside the right context (the scope middleware requires a clinicId). */
const scoped = <T>(clinicId: string, fn: () => Promise<T>) => runWithContext({ clinicId }, async () => await fn());

const TZ = 'Asia/Kolkata';
const at = (hhmm: string, daysAhead = 14) => localDateTimeToUtc(futureWeekdayISO(daysAhead), hhmm, TZ);

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

function create(token: string, body: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/appointments', headers: authHeader(token), payload: body });
}

describe('POST /appointments', () => {
  it('creates an appointment on the happy path (no conflicts)', async () => {
    const s = await setup();
    const res = await create(s.accessToken, {
      patientId: s.patientId,
      doctorId: s.doctorId,
      startsAt: at('10:00').toISOString(),
      durationMinutes: 30,
      procedureHint: 'Cleaning',
    });
    expect(res.statusCode).toBe(201);
    const { appointment, conflicts } = res.json().data;
    expect(appointment.status).toBe('SCHEDULED');
    expect(new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()).toBe(30 * 60_000);
    expect(conflicts).toEqual([]);
  });

  it('rejects a doctor double-booking with a HARD conflict (409)', async () => {
    const s = await setup();
    await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00').toISOString(), durationMinutes: 30 });
    const res = await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:15').toISOString(), durationMinutes: 30 });
    expect(res.statusCode).toBe(409);
    const err = res.json().error;
    expect(err.code).toBe('CONFLICTS');
    expect(err.details.conflicts.map((c: { code: string }) => c.code)).toContain('DOCTOR_DOUBLE_BOOKED');
  });

  it('rejects a room double-booking (409)', async () => {
    const s = await setup();
    const roomId = await createRoom(app, s.clinicId);
    const doc2 = await joinDoctor(app, s.joinCode);
    phones.push(doc2.phone);
    await seedDoctorAvailability(app, s.clinicId, doc2.userId);
    await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, roomId, startsAt: at('10:00').toISOString(), durationMinutes: 30 });
    const res = await create(doc2.accessToken, { patientId: s.patientId, doctorId: doc2.userId, roomId, startsAt: at('10:15').toISOString(), durationMinutes: 30 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.conflicts.map((c: { code: string }) => c.code)).toContain('ROOM_DOUBLE_BOOKED');
  });

  it('rejects an appointment outside clinic hours (409)', async () => {
    const s = await setup();
    const res = await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('08:00').toISOString(), durationMinutes: 30 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.conflicts.map((c: { code: string }) => c.code)).toContain('OUTSIDE_CLINIC_HOURS');
  });

  it('blocks a SOFT conflict until acknowledged, then allows it', async () => {
    // No availability seeded for this doctor → DOCTOR_OUTSIDE_AVAILABILITY (soft, no hard).
    const c = await createDoctorWithClinic(app);
    phones.push(c.phone);
    clinicIds.push(c.clinicId);
    const patientId = await createPatient(app, c.clinicId, c.userId);
    const body = { patientId, doctorId: c.userId, startsAt: at('10:00').toISOString(), durationMinutes: 30 };

    const blocked = await create(c.accessToken, body);
    expect(blocked.statusCode).toBe(409);
    const codes = blocked.json().error.details.conflicts.map((x: { code: string }) => x.code);
    expect(codes).toContain('DOCTOR_OUTSIDE_AVAILABILITY');

    const okRes = await create(c.accessToken, { ...body, acknowledgedSoftConflicts: ['DOCTOR_OUTSIDE_AVAILABILITY'] });
    expect(okRes.statusCode).toBe(201);
    expect(okRes.json().data.conflicts.map((x: { code: string }) => x.code)).toContain('DOCTOR_OUTSIDE_AVAILABILITY');
  });

  it('broadcasts schedule.appointment.created after commit', async () => {
    const s = await setup();
    const events: ServerEvent[] = [];
    setRealtimeEmitter((_room, _name, ev) => events.push(ev));
    try {
      await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('11:00').toISOString(), durationMinutes: 30 });
    } finally {
      setRealtimeEmitter(null);
    }
    expect(events.some((e) => e.type === 'schedule.appointment.created')).toBe(true);
  });

  it('inserts two PENDING reminders (24h + 1h)', async () => {
    const s = await setup();
    const res = await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('12:00').toISOString(), durationMinutes: 30 });
    const apptId = res.json().data.appointment.id;
    const reminders = await scoped(s.clinicId, () => app.prisma.appointmentReminder.findMany({ where: { appointmentId: apptId } }));
    expect(reminders).toHaveLength(2);
    expect(reminders.every((r) => r.status === 'PENDING')).toBe(true);
  });

  it('forbids a doctor from booking into another doctor’s queue (403)', async () => {
    const s = await setup();
    const doc2 = await joinDoctor(app, s.joinCode);
    phones.push(doc2.phone);
    const res = await create(s.accessToken, { patientId: s.patientId, doctorId: doc2.userId, startsAt: at('14:00').toISOString(), durationMinutes: 30 });
    expect(res.statusCode).toBe(403);
  });
});

describe('reschedule / cancel', () => {
  async function createOne(s: Awaited<ReturnType<typeof setup>>, hhmm = '10:00') {
    const res = await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at(hhmm).toISOString(), durationMinutes: 30 });
    return res.json().data.appointment.id as string;
  }

  it('reschedules: sets originalStartsAt and increments rescheduleCount', async () => {
    const s = await setup();
    const id = await createOne(s, '10:00');
    const res = await app.inject({
      method: 'POST',
      url: `/appointments/${id}/reschedule`,
      headers: authHeader(s.accessToken),
      payload: { newStartsAt: at('15:00').toISOString() },
    });
    expect(res.statusCode).toBe(200);
    const a = res.json().data.appointment;
    expect(a.rescheduleCount).toBe(1);
    expect(a.originalStartsAt).not.toBeNull();
    expect(new Date(a.startsAt).getTime()).toBe(at('15:00').getTime());
  });

  it('reschedule cancels old PENDING reminders and creates new ones', async () => {
    const s = await setup();
    const id = await createOne(s, '10:00');
    await app.inject({ method: 'POST', url: `/appointments/${id}/reschedule`, headers: authHeader(s.accessToken), payload: { newStartsAt: at('16:00').toISOString() } });
    const reminders = await scoped(s.clinicId, () => app.prisma.appointmentReminder.findMany({ where: { appointmentId: id } }));
    expect(reminders.filter((r) => r.status === 'CANCELLED')).toHaveLength(2);
    expect(reminders.filter((r) => r.status === 'PENDING')).toHaveLength(2);
  });

  it('cancels with a reason and writes the APPOINTMENT_CANCELLED audit', async () => {
    const s = await setup();
    const id = await createOne(s, '10:00');
    const res = await app.inject({ method: 'POST', url: `/appointments/${id}/cancel`, headers: authHeader(s.accessToken), payload: { reason: 'Patient requested' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.appointment.status).toBe('CANCELLED');
    const audit = await app.prisma.auditLog.findFirst({ where: { action: 'APPOINTMENT_CANCELLED', entityId: id } });
    expect(audit).toBeTruthy();
    expect((audit!.metadata as { reason?: string }).reason).toBe('Patient requested');
    const pending = await scoped(s.clinicId, () => app.prisma.appointmentReminder.count({ where: { appointmentId: id, status: 'PENDING' } }));
    expect(pending).toBe(0);
  });
});

describe('recurring series', () => {
  it('creates a 4-occurrence weekly series with shared seriesId and indexes 1-4', async () => {
    const s = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/appointments/recurring',
      headers: authHeader(s.accessToken),
      payload: {
        patientId: s.patientId,
        doctorId: s.doctorId,
        firstStartsAt: at('10:00').toISOString(),
        durationMinutes: 30,
        totalOccurrences: 4,
        interval: 'WEEKLY',
        procedureHint: 'RCT',
      },
    });
    expect(res.statusCode).toBe(201);
    const { seriesId, appointments } = res.json().data;
    expect(appointments).toHaveLength(4);
    expect(appointments.map((a: { seriesIndex: number }) => a.seriesIndex).sort()).toEqual([1, 2, 3, 4]);
    expect(appointments.every((a: { seriesId: string }) => a.seriesId === seriesId)).toBe(true);
  });

  it('returns 409 SERIES_UNSCHEDULED when occurrences cannot be placed', async () => {
    // Windows entirely before the clinic opens → every occurrence is unschedulable. (No rows at
    // all now defaults to clinic hours — Phase 9.6 Issue 10.2.)
    const c = await createDoctorWithClinic(app);
    phones.push(c.phone);
    clinicIds.push(c.clinicId);
    await seedDoctorAvailability(app, c.clinicId, c.userId, { startTime: '05:00', endTime: '07:00' });
    const patientId = await createPatient(app, c.clinicId, c.userId);
    const res = await app.inject({
      method: 'POST',
      url: '/appointments/recurring',
      headers: authHeader(c.accessToken),
      payload: { patientId, doctorId: c.userId, firstStartsAt: at('10:00').toISOString(), durationMinutes: 30, totalOccurrences: 3, interval: 'WEEKLY' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SERIES_UNSCHEDULED');
    expect(res.json().error.details.unscheduled.length).toBeGreaterThan(0);
  });

  it('cancels "this and future" — keeps earlier occurrences intact', async () => {
    const s = await setup();
    const made = await app.inject({
      method: 'POST',
      url: '/appointments/recurring',
      headers: authHeader(s.accessToken),
      payload: { patientId: s.patientId, doctorId: s.doctorId, firstStartsAt: at('10:00').toISOString(), durationMinutes: 30, totalOccurrences: 4, interval: 'WEEKLY' },
    });
    const seriesId = made.json().data.seriesId as string;
    const res = await app.inject({
      method: 'POST',
      url: `/appointments/series/${seriesId}/cancel`,
      headers: authHeader(s.accessToken),
      payload: { scope: 'THIS_AND_FUTURE', startingFromIndex: 3, reason: 'stop here' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cancelled).toBe(2);
    const members = await scoped(s.clinicId, () => app.prisma.appointment.findMany({ where: { seriesId }, orderBy: { seriesIndex: 'asc' } }));
    expect(members.map((m) => m.status)).toEqual(['SCHEDULED', 'SCHEDULED', 'CANCELLED', 'CANCELLED']);
  });
});

describe('GET /patients/:id/appointments', () => {
  it('returns the patient’s upcoming appointments, isolated per clinic', async () => {
    const s = await setup();
    await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00').toISOString(), durationMinutes: 30 });
    const mine = await app.inject({ method: 'GET', url: `/patients/${s.patientId}/appointments`, headers: authHeader(s.accessToken) });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().data.appointments.length).toBeGreaterThanOrEqual(1);

    const other = await createDoctorWithClinic(app);
    phones.push(other.phone);
    clinicIds.push(other.clinicId);
    const cross = await app.inject({ method: 'GET', url: `/patients/${s.patientId}/appointments`, headers: authHeader(other.accessToken) });
    expect(cross.json().data.appointments).toHaveLength(0); // clinic-scoped
  });
});

describe('cross-clinic isolation', () => {
  it('returns 404 when another clinic tries to cancel an appointment', async () => {
    const s = await setup();
    const id = await create(s.accessToken, { patientId: s.patientId, doctorId: s.doctorId, startsAt: at('10:00').toISOString(), durationMinutes: 30 }).then((r) => r.json().data.appointment.id);
    const other = await createDoctorWithClinic(app);
    phones.push(other.phone);
    clinicIds.push(other.clinicId);
    const res = await app.inject({ method: 'POST', url: `/appointments/${id}/cancel`, headers: authHeader(other.accessToken), payload: { reason: 'x' } });
    expect(res.statusCode).toBe(404);
  });
});
