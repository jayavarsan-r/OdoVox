import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createDoctorWithClinic,
  joinReceptionist,
  seedConsultation,
  authHeader,
} from './helpers.js';
import { startWorkers } from '../src/queues/start-workers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/index.js';
import { getConsultationEventsSince } from '../src/queues/events.js';

/**
 * Phase 9.5 smoke — the exact flow real-user testing broke, end to end over the real stack
 * (HTTP + BullMQ + Redis events + DB): record → process → READY → confirm → visit CHECKOUT →
 * checkout bill carries the dictated cost → receptionist takes payment → visit COMPLETED, bill
 * PAID. If any P0 regresses (pipeline stall, confirm 422 crash, missing checkout transition,
 * missing bill), this fails.
 */

let app: FastifyInstance;
let workers: { stop: () => Promise<void> };
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  workers = startWorkers(app);
});
afterAll(async () => {
  await workers.stop();
  await app.close();
});

const TRANSCRIPT = 'RCT on 26, first of one sitting, completed today. Charge fifteen hundred rupees.';

const FINAL = {
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 1,
  sittingTotal: 1,
  status: 'COMPLETED' as const,
  estimatedCostPaise: 150000,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('full consultation → checkout → payment smoke', () => {
  it('runs the whole clinic loop green', async () => {
    const doctor = await createDoctorWithClinic(app);
    const receptionist = await joinReceptionist(app, doctor.joinCode);
    const { consultationId, visitId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});

    // 1. Doctor records → pipeline (real queue + Redis) reaches READY.
    const audioKey = `clinics/${doctor.clinicId}/audio/${consultationId}.webm`;
    await storage.putObject(audioKey, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${TRANSCRIPT}`), 'audio/webm');
    await app.prisma.consultation.update({ where: { id: consultationId }, data: { audioStorageKey: audioKey } });

    const proc = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/process`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(proc.statusCode).toBe(200);

    let types: string[] = [];
    for (let i = 0; i < 100 && !types.includes('READY') && !types.includes('FAILED'); i++) {
      types = (await getConsultationEventsSince(app.redis, consultationId, 0)).map((e) => e.event.type);
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(types).toContain('READY');

    // 2. Doctor confirms the (edited) findings → visit lands in CHECKOUT.
    const confirm = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(doctor.accessToken),
      payload: { structuredData: FINAL, confirmedWithWarning: false },
    });
    expect(confirm.statusCode).toBe(200);

    await runWithContext({ clinicId: doctor.clinicId }, async () => {
      const visit = await app.prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
      expect(visit.status).toBe('CHECKOUT');
      expect(visit.checkoutStartedAt).not.toBeNull();
    });

    // 3. Receptionist opens Take Payment → the bill exists with the dictated cost.
    const ensure = await app.inject({
      method: 'POST',
      url: `/visits/${visitId}/bill`,
      headers: authHeader(receptionist.accessToken),
    });
    expect([200, 201]).toContain(ensure.statusCode);
    const bill = ensure.json().data as { id: string; balancePaise: number; items: Array<{ unitPricePaise: number }> };
    expect(bill.items[0]!.unitPricePaise).toBe(150000);
    expect(bill.balancePaise).toBeGreaterThan(0);

    // 4. Receptionist takes the full payment and completes the visit.
    const complete = await app.inject({
      method: 'POST',
      url: `/visits/${visitId}/complete`,
      headers: authHeader(receptionist.accessToken),
      payload: {
        acceptBalance: false,
        prescriptionHanded: true,
        nextVisitConfirmed: false,
        payment: { method: 'CASH', amountPaise: bill.balancePaise, notes: 'smoke' },
      },
    });
    expect(complete.statusCode).toBe(200);

    await runWithContext({ clinicId: doctor.clinicId }, async () => {
      const done = await app.prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
      expect(done.status).toBe('COMPLETED');
      const settled = await app.prisma.bill.findUniqueOrThrow({ where: { id: bill.id } });
      expect(settled.status).toBe('PAID');
      expect(settled.balancePaise).toBe(0);
    });
  }, 30000);
});
