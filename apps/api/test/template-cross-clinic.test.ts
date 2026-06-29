import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, authHeader } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const payload = {
  name: 'Clinic A pack',
  medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
};

describe('prescription templates — cross-clinic isolation', () => {
  it('a clinic cannot read, use, or edit another clinic’s template', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);

    const created = (
      await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(clinicA.accessToken),
        payload,
      })
    ).json().data;

    // Not in clinic B's list.
    const list = await app.inject({
      method: 'GET',
      url: '/prescription-templates',
      headers: authHeader(clinicB.accessToken),
    });
    expect(list.json().data.items.map((t: { id: string }) => t.id)).not.toContain(created.id);

    // Detail / use / patch all 404 for clinic B.
    for (const [method, url] of [
      ['GET', `/prescription-templates/${created.id}`],
      ['POST', `/prescription-templates/${created.id}/use`],
      ['PATCH', `/prescription-templates/${created.id}`],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: authHeader(clinicB.accessToken),
        ...(method === 'PATCH' ? { payload: { name: 'x' } } : {}),
      });
      expect(res.statusCode).toBe(404);
    }
  });
});
