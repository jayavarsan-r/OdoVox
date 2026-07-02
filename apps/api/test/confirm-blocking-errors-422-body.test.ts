import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';

/**
 * Regression (Phase 9.5 P0.2): the confirm endpoint re-runs safety on the final edited data and
 * 422s on blocking errors. The web verification card renders those errors inline — so the 422 body
 * is a CONTRACT: `error.code === 'BLOCKING_ERRORS'` and `error.details.blockingErrors` must carry
 * `{ code, message, field }` items the card can map onto its rows. If this shape drifts, the client
 * falls back to an opaque thrown error ("Resolve blocking errors before confirming") — the exact
 * bug users hit in real testing.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /consultations/:id/confirm — blocking errors 422 contract', () => {
  it('returns BLOCKING_ERRORS with per-field details for an invalid FDI tooth', async () => {
    const setup = await createDoctorWithClinic(app);
    const structured = {
      procedure: 'RCT',
      teeth: [19], // 19 is not a valid FDI number → blocking invalid_tooth
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
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, structured);

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(setup.accessToken),
      payload: { structuredData: structured, confirmedWithWarning: false },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json() as {
      ok: boolean;
      error: {
        code: string;
        message: string;
        details?: { blockingErrors?: Array<{ code: string; message: string; field?: string }> };
      };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BLOCKING_ERRORS');
    const errors = body.error.details?.blockingErrors ?? [];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatchObject({ code: 'invalid_tooth', field: 'teeth' });
    expect(errors[0]!.message).toBeTruthy();

    // Nothing committed: the consultation must still be pending, not CONFIRMED.
    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(consult.status).not.toBe('CONFIRMED');
  });
});
