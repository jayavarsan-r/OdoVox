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

const payload = (over: Record<string, unknown> = {}) => ({
  name: 'RCT pack',
  description: 'Antibiotic + analgesic',
  medicines: [
    { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 },
    { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 },
  ],
  tags: ['antibiotic', 'rct'],
  reviewAfterDays: 7,
  ...over,
});

async function create(app: FastifyInstance, token: string, over: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/prescription-templates',
    headers: authHeader(token),
    payload: payload(over),
  });
  return res;
}

describe('prescription templates — CRUD', () => {
  it('creates a template and returns it with usageCount 0', async () => {
    const doc = await createDoctorWithClinic(app);
    const res = await create(app, doc.accessToken);
    expect(res.statusCode).toBe(200);
    const t = res.json().data;
    expect(t.name).toBe('RCT pack');
    expect(t.medicines).toHaveLength(2);
    expect(t.usageCount).toBe(0);
    expect(t.isArchived).toBe(false);

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TEMPLATE_CREATED', entityId: t.id },
    });
    expect(audit).toBeTruthy();
  });

  it('lists non-archived templates for the clinic', async () => {
    const doc = await createDoctorWithClinic(app);
    await create(app, doc.accessToken, { name: 'Post-extraction' });
    const res = await app.inject({
      method: 'GET',
      url: '/prescription-templates',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const names = res.json().data.items.map((t: { name: string }) => t.name);
    expect(names).toContain('Post-extraction');
  });

  it('fetches a single template by id', async () => {
    const doc = await createDoctorWithClinic(app);
    const created = (await create(app, doc.accessToken)).json().data;
    const res = await app.inject({
      method: 'GET',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(created.id);
  });

  it('updates a template and audits it', async () => {
    const doc = await createDoctorWithClinic(app);
    const created = (await create(app, doc.accessToken)).json().data;
    const res = await app.inject({
      method: 'PATCH',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(doc.accessToken),
      payload: { name: 'RCT pack v2', tags: ['antibiotic'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('RCT pack v2');
    expect(res.json().data.tags).toEqual(['antibiotic']);
    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TEMPLATE_UPDATED', entityId: created.id },
    });
    expect(audit).toBeTruthy();
  });

  it('archives (soft-deletes) a template — it drops out of the list', async () => {
    const doc = await createDoctorWithClinic(app);
    const created = (await create(app, doc.accessToken)).json().data;
    const del = await app.inject({
      method: 'DELETE',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(doc.accessToken),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.isArchived).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/prescription-templates',
      headers: authHeader(doc.accessToken),
    });
    const ids = list.json().data.items.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(created.id);

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TEMPLATE_ARCHIVED', entityId: created.id },
    });
    expect(audit).toBeTruthy();
  });
});
