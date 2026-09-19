import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';

/**
 * DoctorAvailability must not accept the same window twice (deviation #110).
 *
 * It used to. `@@unique([doctorId, dayOfWeek, startTime, effectiveFrom])` looked like it
 * prevented this, but `effectiveFrom` is null for "always" availability and Postgres treats
 * NULLs as distinct — so two identical always-rows were not duplicates to the index, and the
 * constraint had never applied to a single row in the database.
 *
 * The cost was not theoretical. The seed believed itself idempotent via
 * createMany({ skipDuplicates: true }), which only skips what the index calls a duplicate,
 * so the dev clinic accumulated 27 identical windows per weekday and the availability screen
 * became unreadable. In the application the same hole makes a doctor doubly available to the
 * booking engine.
 *
 * Migration 20260909090000 rebuilds the index with NULLS NOT DISTINCT. These tests fail if
 * anyone regenerates it from schema.prisma alone, which silently drops that clause.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const window = { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' };

describe('POST /availability/doctor/:doctorId', () => {
  it('accepts a window once', async () => {
    const doc = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${doc.userId}`,
      headers: authHeader(doc.accessToken),
      payload: window,
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects the SAME window a second time — with a message, not a crash', async () => {
    const doc = await createDoctorWithClinic(app);
    const post = () =>
      app.inject({
        method: 'POST',
        url: `/availability/doctor/${doc.userId}`,
        headers: authHeader(doc.accessToken),
        payload: window,
      });

    expect((await post()).statusCode).toBe(201);

    const second = await post();
    // 409, not 500: tapping Add twice is an ordinary slip and the window they wanted exists.
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('AVAILABILITY_DUPLICATE');
  });

  it('still allows a SECOND window on the same day at a different time', async () => {
    // The clinic splits the day — morning and afternoon. Only an identical window is a
    // duplicate, and over-constraining this would break the frame's own example.
    const doc = await createDoctorWithClinic(app);
    const morning = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${doc.userId}`,
      headers: authHeader(doc.accessToken),
      payload: { dayOfWeek: 1, startTime: '09:30', endTime: '13:00' },
    });
    const afternoon = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${doc.userId}`,
      headers: authHeader(doc.accessToken),
      payload: { dayOfWeek: 1, startTime: '14:00', endTime: '20:30' },
    });
    expect(morning.statusCode).toBe(201);
    expect(afternoon.statusCode).toBe(201);
  });

  it('the same time on a different day is not a duplicate', async () => {
    const doc = await createDoctorWithClinic(app);
    const mon = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${doc.userId}`,
      headers: authHeader(doc.accessToken),
      payload: window,
    });
    const tue = await app.inject({
      method: 'POST',
      url: `/availability/doctor/${doc.userId}`,
      headers: authHeader(doc.accessToken),
      payload: { ...window, dayOfWeek: 2 },
    });
    expect(mon.statusCode).toBe(201);
    expect(tue.statusCode).toBe(201);
  });
});
