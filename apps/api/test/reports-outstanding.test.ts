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

describe('Outstanding report', () => {
  it('lists a patient with an unpaid balance (oldest first)', async () => {
    // Pay only part of a ₹10,000 bill → ₹6,000 outstanding.
    const { recp, patientId } = await paidBill(app, 1000000, 400000, 'outstanding-key-1');
    const res = await app.inject({ method: 'GET', url: '/reports/outstanding', headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    const mine = data.patients.find((p: { patientId: string }) => p.patientId === patientId);
    expect(mine).toBeTruthy();
    expect(mine.balancePaise).toBe(600000);
    expect(mine.billCount).toBe(1);
    expect(data.totalOutstandingPaise).toBeGreaterThanOrEqual(600000);
  });
});
