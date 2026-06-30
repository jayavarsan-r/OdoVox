import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { paidBill } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Daily collection report', () => {
  it("includes today's cash payment in the totals + method breakdown", async () => {
    const { recp } = await paidBill(app, 470000, 470000, 'daily-coll-key-1');
    const res = await app.inject({ method: 'GET', url: '/reports/daily-collection', headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    // Shared dev DB → assert "at least", not exact, for clinic-wide aggregates.
    expect(data.totalCollectedPaise).toBeGreaterThanOrEqual(470000);
    expect(data.byMethod.CASH).toBeGreaterThanOrEqual(470000);
    expect(data.transactionCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.byDoctor)).toBe(true);
  });
});
