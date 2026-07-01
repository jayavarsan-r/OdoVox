import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { checkConsent } from '../src/lib/whatsapp/consent.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

describe('WhatsApp consent gate', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  async function seedConsent(clinicId: string, patientId: string, status: string) {
    await runWithContext({ clinicId }, async () => {
      await app.prisma.patientWhatsAppConsent.create({
        data: { clinicId, patientId, status: status as never, optedInAt: new Date() },
      });
    });
  }

  it('blocks when consent row is missing (NOT_ASKED)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate).toEqual({ canSend: false, reason: 'NOT_ASKED' });
  });

  it('blocks when OPTED_OUT', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedConsent(doctor.clinicId, patientId, 'OPTED_OUT');
    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate.canSend).toBe(false);
    expect(gate.reason).toBe('OPTED_OUT');
  });

  it('blocks when PENDING', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedConsent(doctor.clinicId, patientId, 'PENDING');
    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate.canSend).toBe(false);
    expect(gate.reason).toBe('PENDING');
  });

  it('allows when OPTED_IN and fresh', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedConsent(doctor.clinicId, patientId, 'OPTED_IN');
    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate.canSend).toBe(true);
  });
});
