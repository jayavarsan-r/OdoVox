import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  createPatient,
  futureWeekdayISO,
  seedDoctorAvailability,
} from './helpers.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import { runWithContext } from '../src/lib/request-context.js';
import { runNoShowSweep } from '../src/queues/schedule-cron.js';

const TZ = 'Asia/Kolkata';
const MIN = 60_000;
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

const scoped = <T>(clinicId: string, fn: () => Promise<T>) => runWithContext({ clinicId }, async () => await fn());

async function setup() {
  const c = await createDoctorWithClinic(app);
  phones.push(c.phone);
  clinicIds.push(c.clinicId);
  await seedDoctorAvailability(app, c.clinicId, c.userId);
  const patientId = await createPatient(app, c.clinicId, c.userId);
  return { ...c, doctorId: c.userId, patientId };
}

async function book(s: Awaited<ReturnType<typeof setup>>, hhmm = '10:00') {
  const startsAt = localDateTimeToUtc(futureWeekdayISO(20), hhmm, TZ);
  const res = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: authHeader(s.accessToken),
    payload: { patientId: s.patientId, doctorId: s.doctorId, startsAt: startsAt.toISOString(), durationMinutes: 30 },
  });
  return { id: res.json().data.appointment.id as string, startsAt };
}

const reload = (clinicId: string, id: string) =>
  scoped(clinicId, () => app.prisma.appointment.findFirst({ where: { id } }));

describe('NO_SHOW cron sweep', () => {
  it('marks a past-due SCHEDULED appointment NO_SHOW once grace elapses', async () => {
    const s = await setup();
    const { id, startsAt } = await book(s, '10:00');
    const res = await runNoShowSweep({ prisma: app.prisma, now: new Date(startsAt.getTime() + 31 * MIN) });
    expect(res.ids).toContain(id);
    const appt = await reload(s.clinicId, id);
    expect(appt!.status).toBe('NO_SHOW');
    expect(appt!.noShowAt).not.toBeNull();
  });

  it('respects the grace window (not yet due)', async () => {
    const s = await setup();
    const { id, startsAt } = await book(s, '11:00');
    // grace default 30 min → 29 min after start is still within grace.
    await runNoShowSweep({ prisma: app.prisma, now: new Date(startsAt.getTime() + 29 * MIN) });
    const appt = await reload(s.clinicId, id);
    expect(appt!.status).toBe('SCHEDULED');
  });

  it('does not mark an already CHECKED_IN appointment', async () => {
    const s = await setup();
    const { id, startsAt } = await book(s, '12:00');
    await scoped(s.clinicId, () => app.prisma.appointment.update({ where: { id }, data: { status: 'CHECKED_IN' } }));
    await runNoShowSweep({ prisma: app.prisma, now: new Date(startsAt.getTime() + 60 * MIN) });
    const appt = await reload(s.clinicId, id);
    expect(appt!.status).toBe('CHECKED_IN');
  });

  it('cancels pending reminders for marked appointments', async () => {
    const s = await setup();
    const { id, startsAt } = await book(s, '14:00');
    await runNoShowSweep({ prisma: app.prisma, now: new Date(startsAt.getTime() + 31 * MIN) });
    const reminders = await scoped(s.clinicId, () => app.prisma.appointmentReminder.findMany({ where: { appointmentId: id } }));
    expect(reminders.filter((r) => r.status === 'PENDING')).toHaveLength(0);
    expect(reminders.filter((r) => r.status === 'CANCELLED').length).toBeGreaterThanOrEqual(2);
  });
});
