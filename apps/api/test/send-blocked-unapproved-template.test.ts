import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — template gating', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  async function trySend(clinicId: string, userId: string, patientId: string, deps: ReturnType<typeof makeSendDeps>, templateKey: string) {
    return runWithContext({ clinicId, userId }, () =>
      sendWhatsAppMessage(deps, { clinicId, patientId, templateKey, variables: { 1: 'Meera', 2: 'Smile Dental' } }),
    );
  }

  it('blocks a PENDING (unapproved) template', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'unapproved_tpl', { approvalStatus: 'PENDING' });
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);
    const outcome = await trySend(doctor.clinicId, doctor.userId, patientId, deps, 'unapproved_tpl');
    expect(outcome.reason).toBe('TEMPLATE_NOT_APPROVED');
    expect(deps.enqueued).toHaveLength(0);
  });

  it('blocks a disabled template', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'disabled_tpl', { isEnabled: false });
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);
    const outcome = await trySend(doctor.clinicId, doctor.userId, patientId, deps, 'disabled_tpl');
    expect(outcome.reason).toBe('TEMPLATE_DISABLED');
  });

  it('blocks a non-existent template', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);
    const outcome = await trySend(doctor.clinicId, doctor.userId, patientId, deps, 'ghost_tpl');
    expect(outcome.reason).toBe('TEMPLATE_NOT_FOUND');
  });
});
