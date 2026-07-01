import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';
import { seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('WhatsApp settings — template toggle', () => {
  it('lists templates and toggles one off (admin)', async () => {
    const doc = await createDoctorWithClinic(app); // the founding doctor is the clinic admin
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h');

    const settings = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(doc.accessToken) });
    expect(settings.statusCode).toBe(200);
    const tpl = settings.json().data.templates.find((t: { templateKey: string }) => t.templateKey === 'appointment_reminder_24h');
    expect(tpl.isEnabled).toBe(true);
    expect(tpl.sentThisMonth).toBe(0);

    const toggle = await app.inject({
      method: 'PATCH',
      url: '/clinic/whatsapp/templates/appointment_reminder_24h',
      headers: authHeader(doc.accessToken),
      payload: { isEnabled: false },
    });
    expect(toggle.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(doc.accessToken) });
    const tplAfter = after.json().data.templates.find((t: { templateKey: string }) => t.templateKey === 'appointment_reminder_24h');
    expect(tplAfter.isEnabled).toBe(false);
  });

  it('rejects a non-admin (receptionist) from reading settings', async () => {
    const doc = await createDoctorWithClinic(app);
    const { joinReceptionist } = await import('./helpers.js');
    const recp = await joinReceptionist(app, doc.joinCode);
    const res = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(recp.accessToken) });
    expect(res.statusCode).toBe(403);
  });
});
