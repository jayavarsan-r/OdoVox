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
} from './helpers.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';

/**
 * Phase 9.6 Issue 10.2: "Schedule all" on the plan page 409'd for every clinic whose doctors
 * never configured weekly availability — the slot search returned nothing while manual booking
 * only soft-warned. An unconfigured doctor now defaults to the clinic's open hours, so the
 * remaining sittings schedule cleanly and stay linked to the plan.
 */

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

describe('schedule remaining sittings — unconfigured doctor', () => {
  it('a doctor with NO availability rows schedules the series inside clinic hours (201)', async () => {
    const c = await createDoctorWithClinic(app);
    phones.push(c.phone);
    clinicIds.push(c.clinicId);
    const patientId = await createPatient(app, c.clinicId, c.userId);
    // 1 of 4 sittings done (Issue 10.1 fixed) → 3 remain.
    const plan = await seedActivePlan(app, c.clinicId, c.userId, patientId, {
      procedure: 'RCT',
      totalSittings: 4,
      completedSittings: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/appointments/recurring',
      headers: authHeader(c.accessToken),
      payload: {
        patientId,
        doctorId: c.userId,
        firstStartsAt: localDateTimeToUtc(futureWeekdayISO(14), '10:00', TZ).toISOString(),
        durationMinutes: 30,
        totalOccurrences: 3,
        interval: 'BIWEEKLY',
        procedureHint: 'RCT',
        treatmentPlanId: plan.planId,
      },
    });

    expect(res.statusCode).toBe(201);
    const appts = res.json().data.appointments;
    expect(appts).toHaveLength(3);
    expect(appts.every((a: { treatmentPlanId: string }) => a.treatmentPlanId === plan.planId)).toBe(true);
    expect(appts.every((a: { status: string }) => a.status === 'SCHEDULED')).toBe(true);
  });
});
