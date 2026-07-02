import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServerEvent } from '@odovox/types';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';
import { clinicRoom, setRealtimeEmitter } from '../src/lib/realtime/broadcast.js';

/**
 * Regression (Phase 9.5 P0.3): after a successful confirm the receptionist's "Ready for Checkout"
 * section must update instantly — the route broadcasts `queue.visit.checkout` to the clinic room
 * AFTER the commit. If that emit is dropped (as happened when confirm threw before reaching it),
 * the patient silently never appears at the front desk.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
afterEach(() => setRealtimeEmitter(null));

const FINAL = {
  procedure: 'Scaling',
  teeth: [26],
  sittingCurrent: null,
  sittingTotal: null,
  status: 'COMPLETED' as const,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('POST /consultations/:id/confirm — checkout broadcast', () => {
  it('emits queue.visit.checkout to the clinic room with the CHECKOUT visit', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, visitId } = await seedConsultation(app, setup.clinicId, setup.userId, FINAL);

    const emitted: Array<{ room: string; event: ServerEvent }> = [];
    setRealtimeEmitter((room, _name, event) => emitted.push({ room, event }));

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(setup.accessToken),
      payload: { structuredData: FINAL, confirmedWithWarning: false },
    });
    expect(res.statusCode).toBe(200);

    const checkout = emitted.find((e) => e.event.type === 'queue.visit.checkout');
    expect(checkout).toBeTruthy();
    expect(checkout!.room).toBe(clinicRoom(setup.clinicId));
    const payload = checkout!.event.payload as { id: string; status: string };
    expect(payload.id).toBe(visitId);
    expect(payload.status).toBe('CHECKOUT');
  });
});
