import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createDoctorWithClinic,
  joinReceptionist,
  joinDoctor,
  authHeader,
} from './helpers.js';

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
  medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
};

describe('prescription templates — RBAC', () => {
  it('receptionist can read but cannot create templates', async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);

    const created = (
      await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(doc.accessToken),
        payload,
      })
    ).json().data;

    // Read: allowed.
    const list = await app.inject({
      method: 'GET',
      url: '/prescription-templates',
      headers: authHeader(recep.accessToken),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items.map((t: { id: string }) => t.id)).toContain(created.id);

    // Create: forbidden.
    const create = await app.inject({
      method: 'POST',
      url: '/prescription-templates',
      headers: authHeader(recep.accessToken),
      payload,
    });
    expect(create.statusCode).toBe(403);
  });

  it('a different doctor (non-creator, non-admin) cannot edit or archive', async () => {
    const owner = await createDoctorWithClinic(app);
    const other = await joinDoctor(app, owner.joinCode);

    const created = (
      await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(owner.accessToken),
        payload,
      })
    ).json().data;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(other.accessToken),
      payload: { name: 'hijacked' },
    });
    expect(patch.statusCode).toBe(403);

    const del = await app.inject({
      method: 'DELETE',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(other.accessToken),
    });
    expect(del.statusCode).toBe(403);
  });

  it('the creator can edit and archive their own template', async () => {
    const owner = await createDoctorWithClinic(app);
    const created = (
      await app.inject({
        method: 'POST',
        url: '/prescription-templates',
        headers: authHeader(owner.accessToken),
        payload,
      })
    ).json().data;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(owner.accessToken),
      payload: { name: 'owner-curated' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.name).toBe('owner-curated');

    const del = await app.inject({
      method: 'DELETE',
      url: `/prescription-templates/${created.id}`,
      headers: authHeader(owner.accessToken),
    });
    expect(del.statusCode).toBe(200);
  });
});
