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

describe('Patient statement PDF', () => {
  it('generates a statement PDF and returns a signed URL', async () => {
    const { recp, patientId } = await paidBill(app, 350000, 350000, 'statement-key-1');
    const res = await app.inject({
      method: 'GET',
      url: `/reports/patient-statement?patientId=${patientId}`,
      headers: authHeader(recp.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().data.url).toBe('string');
    expect(res.json().data.url.length).toBeGreaterThan(0);
  });
});
