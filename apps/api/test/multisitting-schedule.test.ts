import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  createPatient,
  futureWeekdayISO,
  seedActivePlan,
  seedDoctorAvailability,
} from './helpers.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import { runWithContext } from '../src/lib/request-context.js';

const TZ = 'Asia/Kolkata';
const at = (hhmm: string) => localDateTimeToUtc(futureWeekdayISO(14), hhmm, TZ);
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
  const plan = await seedActivePlan(app, c.clinicId, c.userId, patientId, { procedure: 'RCT', totalSittings: 4, completedSittings: 0 });
  return { ...c, doctorId: c.userId, patientId, planId: plan.planId };
}

function recurring(s: Awaited<ReturnType<typeof setup>>, over: Record<string, unknown> = {}) {
  return app.inject({
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
      treatmentPlanId: s.planId,
      ...over,
    },
  });
}

describe('multi-sitting auto-schedule', () => {
  it('links a recurring series to the treatment plan', async () => {
    const s = await setup();
    const res = await recurring(s);
    expect(res.statusCode).toBe(201);
    const appts = res.json().data.appointments;
    expect(appts).toHaveLength(4);
    expect(appts.every((a: { treatmentPlanId: string }) => a.treatmentPlanId === s.planId)).toBe(true);
  });

  it('cancels remaining SCHEDULED appointments when the plan is cancelled', async () => {
    const s = await setup();
    await recurring(s);
    const res = await app.inject({
      method: 'POST',
      url: `/plans/${s.planId}/cancel`,
      headers: authHeader(s.accessToken),
      payload: { reason: 'Patient moved away' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.cancelledAppointments).toBe(4);
    const appts = await scoped(s.clinicId, () => app.prisma.appointment.findMany({ where: { treatmentPlanId: s.planId } }));
    expect(appts.every((a) => a.status === 'CANCELLED')).toBe(true);
    expect(appts.every((a) => a.cancellationReason === 'Treatment plan cancelled.')).toBe(true);
  });

  it('does NOT cancel already-COMPLETED appointments when the plan is cancelled', async () => {
    const s = await setup();
    const made = await recurring(s);
    const firstId = made.json().data.appointments[0].id as string;
    await scoped(s.clinicId, () => app.prisma.appointment.update({ where: { id: firstId }, data: { status: 'COMPLETED' } }));

    await app.inject({ method: 'POST', url: `/plans/${s.planId}/cancel`, headers: authHeader(s.accessToken), payload: { reason: 'stop' } });

    const first = await scoped(s.clinicId, () => app.prisma.appointment.findFirst({ where: { id: firstId } }));
    expect(first!.status).toBe('COMPLETED'); // untouched
    const cancelled = await scoped(s.clinicId, () => app.prisma.appointment.count({ where: { treatmentPlanId: s.planId, status: 'CANCELLED' } }));
    expect(cancelled).toBe(3);
  });

  it('returns a preview of placed + unscheduled occurrences when some cannot be slotted (409)', async () => {
    // Doctor whose configured windows fall entirely OUTSIDE clinic hours → nothing can be placed.
    // (Phase 9.6 Issue 10.2: a doctor with NO rows now defaults to clinic hours — see
    // schedule-all-remaining-sittings.test.ts — so the 409 path needs an explicit bad window.)
    const c = await createDoctorWithClinic(app);
    phones.push(c.phone);
    clinicIds.push(c.clinicId);
    await seedDoctorAvailability(app, c.clinicId, c.userId, { startTime: '05:00', endTime: '07:00' });
    const patientId = await createPatient(app, c.clinicId, c.userId);
    const plan = await seedActivePlan(app, c.clinicId, c.userId, patientId, { procedure: 'RCT', totalSittings: 3, completedSittings: 0 });
    const res = await app.inject({
      method: 'POST',
      url: '/appointments/recurring',
      headers: authHeader(c.accessToken),
      payload: { patientId, doctorId: c.userId, firstStartsAt: at('10:00').toISOString(), durationMinutes: 30, totalOccurrences: 3, interval: 'WEEKLY', treatmentPlanId: plan.planId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SERIES_UNSCHEDULED');
    expect(res.json().error.details.unscheduled).toHaveLength(3);
  });

  it('places a biweekly series ~14 days apart', async () => {
    const s = await setup();
    const res = await recurring(s, { interval: 'BIWEEKLY', totalOccurrences: 2 });
    expect(res.statusCode).toBe(201);
    const appts = res.json().data.appointments;
    expect(appts).toHaveLength(2);
    const days = appts.map((a: { startsAt: string }) => new Date(a.startsAt).getTime());
    expect(days[1] - days[0]).toBeGreaterThanOrEqual(13 * 24 * 60 * 60 * 1000);
  });
});
