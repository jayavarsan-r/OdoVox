import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServerEvent } from '@odovox/types';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  seedConsultation,
  seedDoctorAvailability,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';
import { localDateISO, localDateTimeToUtc, utcToZonedParts } from '../src/lib/schedule/tz.js';
import { setRealtimeEmitter } from '../src/lib/realtime/broadcast.js';

const TZ = 'Asia/Kolkata';
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

function extraction(over: Record<string, unknown> = {}) {
  return {
    procedure: 'Cleaning',
    teeth: [],
    prescriptions: [],
    followUp: { afterDays: 7, procedureHint: 'Cleaning' },
    toothStatusUpdates: [],
    clarifications: [],
    safetyWarnings: [],
    notes: null,
    ...over,
  };
}

async function base(seedAvail = true, availOpts?: { startTime?: string; endTime?: string }) {
  const c = await createDoctorWithClinic(app);
  phones.push(c.phone);
  clinicIds.push(c.clinicId);
  if (seedAvail) await seedDoctorAvailability(app, c.clinicId, c.userId, availOpts);
  return c;
}

async function commit(c: Awaited<ReturnType<typeof base>>, data: Record<string, unknown>) {
  const { consultationId } = await seedConsultation(app, c.clinicId, c.userId, data);
  const result = await commitConsultation(app.prisma, { consultationId, structuredData: data, userId: c.userId, confirmedWithWarning: false });
  return { ...result, consultationId };
}

const reloadAppt = (clinicId: string, id: string) =>
  scoped(clinicId, () => app.prisma.appointment.findFirstOrThrow({ where: { id } }));

describe('voice follow-up → availability-aware appointment', () => {
  it('finds a real slot when the doctor is available', async () => {
    const c = await base(true);
    const res = await commit(c, extraction());
    expect(res.appointmentId).toBeTruthy();
    expect(res.appointmentWarning ?? null).toBeNull();
    const appt = await reloadAppt(c.clinicId, res.appointmentId!);
    expect(appt.status).toBe('SCHEDULED');
  });

  it('surfaces a NO_AVAILABLE_SLOT warning when no slot can be found', async () => {
    // Windows entirely before the clinic opens → never a slot. (No rows at all now defaults to
    // clinic hours — Phase 9.6 Issue 10.2 — so the warning path needs an explicit bad window.)
    const c = await base(true, { startTime: '05:00', endTime: '07:00' });
    const res = await commit(c, extraction());
    expect(res.appointmentWarning).toMatch(/NO_AVAILABLE_SLOT/);
    const consult = await scoped(c.clinicId, () =>
      app.prisma.consultation.findUniqueOrThrow({ where: { id: res.consultationId } }),
    );
    expect(consult.safetyWarnings.some((w) => w.includes('NO_AVAILABLE_SLOT'))).toBe(true);
  });

  it("respects the doctor's working hours (afternoon-only availability)", async () => {
    const c = await base(true, { startTime: '14:00', endTime: '18:00' });
    const res = await commit(c, extraction());
    const appt = await reloadAppt(c.clinicId, res.appointmentId!);
    expect(utcToZonedParts(appt.startsAt, TZ).hour).toBeGreaterThanOrEqual(14);
  });

  it('skips a day-off on the target date and rolls forward', async () => {
    const c = await base(true);
    const targetISO = localDateISO(new Date(Date.now() + 7 * 86_400_000), TZ);
    await scoped(c.clinicId, () =>
      app.prisma.dayOff.create({
        data: { clinicId: c.clinicId, date: localDateTimeToUtc(targetISO, '00:00', TZ), scope: 'CLINIC', createdById: c.userId },
      }),
    );
    const res = await commit(c, extraction());
    const appt = await reloadAppt(c.clinicId, res.appointmentId!);
    expect(localDateISO(appt.startsAt, TZ)).not.toBe(targetISO);
  });

  it('inserts reminders for the auto-scheduled appointment', async () => {
    const c = await base(true);
    const res = await commit(c, extraction());
    const reminders = await scoped(c.clinicId, () => app.prisma.appointmentReminder.findMany({ where: { appointmentId: res.appointmentId! } }));
    expect(reminders).toHaveLength(2);
  });

  it('broadcasts schedule.appointment.created via the confirm route', async () => {
    const c = await base(true);
    const data = extraction();
    const { consultationId } = await seedConsultation(app, c.clinicId, c.userId, data);
    const events: ServerEvent[] = [];
    setRealtimeEmitter((_room, _name, ev) => events.push(ev));
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/consultations/${consultationId}/confirm`,
        headers: authHeader(c.accessToken),
        payload: { structuredData: data },
      });
      expect(res.statusCode).toBe(200);
    } finally {
      setRealtimeEmitter(null);
    }
    expect(events.some((e) => e.type === 'schedule.appointment.created')).toBe(true);
  });
});
