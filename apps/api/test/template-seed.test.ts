import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { STARTER_TEMPLATES } from '@odovox/db';
import { buildTestApp, createDoctorWithClinic, authHeader } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('prescription templates — starter seed set', () => {
  it('ships exactly 5 valid starter templates that list cleanly in a fresh clinic', async () => {
    expect(STARTER_TEMPLATES).toHaveLength(5);
    expect(STARTER_TEMPLATES.map((t) => t.name)).toEqual([
      'RCT pack',
      'Post-extraction',
      'Pediatric mild infection',
      'Periodontal cleanup',
      'Generic pain mgmt',
    ]);
    for (const t of STARTER_TEMPLATES) {
      expect(t.medicines.length).toBeGreaterThanOrEqual(1);
      expect(t.tags.length).toBeGreaterThanOrEqual(1);
    }

    // Seeding the exact starter set into a fresh clinic yields 5 listable templates.
    const doc = await createDoctorWithClinic(app);
    for (const t of STARTER_TEMPLATES) {
      const res = await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(doc.accessToken),
        payload: {
          name: t.name,
          description: t.description,
          tags: t.tags,
          reviewAfterDays: t.reviewAfterDays,
          medicines: t.medicines,
        },
      });
      expect(res.statusCode).toBe(200);
    }

    const list = await app.inject({
      method: 'GET',
      url: '/prescription-templates',
      headers: authHeader(doc.accessToken),
    });
    expect(list.json().data.items).toHaveLength(5);
  });
});
