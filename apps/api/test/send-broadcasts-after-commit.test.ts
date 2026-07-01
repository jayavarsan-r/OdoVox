import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServerEvent } from '@odovox/types';
import { runWithContext } from '../src/lib/request-context.js';
import { setRealtimeEmitter } from '../src/lib/realtime/broadcast.js';
import { sendWhatsAppMessage, runWhatsAppSendJob } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — broadcast after commit', () => {
  let app: FastifyInstance;
  const captured: { room: string; event: ServerEvent }[] = [];
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
    setRealtimeEmitter((room, _name, event) => captured.push({ room, event }));
  });
  afterAll(async () => {
    setRealtimeEmitter(null);
    await app.close();
  });

  it('emits whatsapp.message.sent to the clinic room once the message is SENT', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h');
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );
    captured.length = 0;
    await runWhatsAppSendJob({ prisma: app.prisma, provider: deps.provider }, outcome.messageId!);

    const evt = captured.find((c) => c.event.type === 'whatsapp.message.sent');
    expect(evt).toBeDefined();
    expect(evt!.room).toBe(`clinic:${doctor.clinicId}`);
    if (evt!.event.type === 'whatsapp.message.sent') {
      expect(evt!.event.payload.message.id).toBe(outcome.messageId);
      expect(evt!.event.payload.message.status).toBe('SENT');
    }
  });
});
