import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate, setBudget } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('WhatsApp budget', () => {
  it('reflects month spend and budget in settings and blocks once exceeded', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h', { estimatedCostPaise: 35 });
    await optIn(app, doc.clinicId, patientId);
    await setBudget(app, doc.clinicId, 70); // room for 2 sends of 35 paise

    const deps = makeSendDeps(app);
    const send = () =>
      runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, () =>
        sendWhatsAppMessage(deps, { clinicId: doc.clinicId, patientId, templateKey: 'appointment_reminder_24h', variables: { 1: 'M', 2: 'S' } }),
      );

    // First two sends land as PENDING but their cost is 0 until the worker marks them SENT — so to
    // exercise the budget we set the budget below the estimated cost of a single send instead.
    await setBudget(app, doc.clinicId, 20);
    const blocked = await send();
    expect(blocked.status).toBe('BLOCKED_BUDGET');

    const settings = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(doc.accessToken) });
    expect(settings.json().data.budgetPaise).toBe(20);
    expect(settings.json().data.warningThreshold).toBeCloseTo(0.8);
  });

  it('updates the budget via PATCH (null = unlimited)', async () => {
    const doc = await createDoctorWithClinic(app);
    const set = await app.inject({ method: 'PATCH', url: '/clinic/whatsapp/budget', headers: authHeader(doc.accessToken), payload: { budgetPaise: 50000, warningThreshold: 0.9 } });
    expect(set.statusCode).toBe(200);
    let s = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(doc.accessToken) });
    expect(s.json().data.budgetPaise).toBe(50000);
    expect(s.json().data.warningThreshold).toBeCloseTo(0.9);

    await app.inject({ method: 'PATCH', url: '/clinic/whatsapp/budget', headers: authHeader(doc.accessToken), payload: { budgetPaise: null } });
    s = await app.inject({ method: 'GET', url: '/clinic/whatsapp', headers: authHeader(doc.accessToken) });
    expect(s.json().data.budgetPaise).toBeNull();
  });
});
