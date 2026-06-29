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
  name: 'RCT pack',
  medicines: [
    { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 },
    { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 },
  ],
  reviewAfterDays: 7,
};

async function createTemplate(app: FastifyInstance, token: string) {
  return (
    await app.inject({
      method: 'POST',
      url: '/prescription-templates',
      headers: authHeader(token),
      payload,
    })
  ).json().data;
}

describe('prescription templates — use increments usageCount', () => {
  it('POST /:id/use returns the full medicines list and bumps usageCount', async () => {
    const doc = await createDoctorWithClinic(app);
    const created = await createTemplate(app, doc.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/prescription-templates/${created.id}/use`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.medicines).toHaveLength(2);
    expect(data.reviewAfterDays).toBe(7);
    expect(data.usageCount).toBe(1);

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TEMPLATE_USED', entityId: created.id },
    });
    expect(audit).toBeTruthy();
  });

  it('increments cumulatively across repeated uses', async () => {
    const doc = await createDoctorWithClinic(app);
    const created = await createTemplate(app, doc.accessToken);
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: `/prescription-templates/${created.id}/use`,
        headers: authHeader(doc.accessToken),
      });
    }
    const detail = await app.inject({
      method: 'GET',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(doc.accessToken),
    });
    expect(detail.json().data.usageCount).toBe(3);
  });
});
