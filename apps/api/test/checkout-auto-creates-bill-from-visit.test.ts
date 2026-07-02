import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

/**
 * Regression (Phase 9.5 P1.5, Issue 3): the Take Payment sheet showed "Due: —" because nothing
 * created a Bill when checkout opened — the doctor's dictated cost (Procedure.estimatedCostPaise,
 * Phase 8 §4.2) never reached the receptionist. POST /visits/:id/bill is the idempotent "ensure"
 * the sheet calls on open: it creates the DRAFT bill auto-populated from the visit's procedures
 * (+ lab charges), or returns the existing one unchanged.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const RCT_WITH_COST = {
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 1,
  sittingTotal: 1,
  status: 'COMPLETED' as const,
  estimatedCostPaise: 150000, // ₹1,500 dictated by the doctor
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('POST /visits/:id/bill — ensure the checkout bill exists', () => {
  it('creates a DRAFT bill whose PROCEDURE item carries the dictated cost', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, visitId } = await seedConsultation(app, setup.clinicId, setup.userId, RCT_WITH_COST);
    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: RCT_WITH_COST,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visitId}/bill`,
      headers: authHeader(setup.accessToken),
    });
    expect(res.statusCode).toBe(201);
    const bill = res.json().data as {
      id: string;
      status: string;
      subtotalPaise: number;
      balancePaise: number;
      items: Array<{ kind: string; description: string; unitPricePaise: number }>;
    };
    expect(bill.status).toBe('DRAFT');
    expect(bill.items).toHaveLength(1);
    expect(bill.items[0]).toMatchObject({ kind: 'PROCEDURE', unitPricePaise: 150000 });
    expect(bill.items[0]!.description).toContain('RCT');
    expect(bill.subtotalPaise).toBe(150000);
    expect(bill.balancePaise).toBeGreaterThan(0);

    // Idempotent: a second open returns the SAME bill, no duplicate.
    const again = await app.inject({
      method: 'POST',
      url: `/visits/${visitId}/bill`,
      headers: authHeader(setup.accessToken),
    });
    expect(again.statusCode).toBe(200);
    expect((again.json().data as { id: string }).id).toBe(bill.id);
  });

  it('a costless procedure still yields a visible zero-priced item (never "Due: —")', async () => {
    const setup = await createDoctorWithClinic(app);
    const noCost = { ...RCT_WITH_COST, procedure: 'Scaling', estimatedCostPaise: undefined };
    const { consultationId, visitId } = await seedConsultation(app, setup.clinicId, setup.userId, noCost);
    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: noCost,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visitId}/bill`,
      headers: authHeader(setup.accessToken),
    });
    expect(res.statusCode).toBe(201);
    const bill = res.json().data as { items: Array<{ unitPricePaise: number }>; subtotalPaise: number };
    expect(bill.items).toHaveLength(1); // the item shows; receptionist edits the price
    expect(bill.items[0]!.unitPricePaise).toBe(0);
    expect(bill.subtotalPaise).toBe(0);
  });
});
