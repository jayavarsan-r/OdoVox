import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedActivePlan, seedConsultation } from './helpers.js';
import { runExtractionJob } from '../src/queues/extraction-worker.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';
import { encryptField } from '../src/lib/encryption.js';

/**
 * Phase 9.6 Issue 12: "same treatment continuation not able to gather the tooth" — a dictation
 * like "continuing the RCT, second sitting" names no tooth, so the card showed Tooth: —. A
 * continuation inherits the plan's teeth: the extraction worker backfills them for the card, and
 * the confirm transaction backfills them for the persisted record.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('continuation fills teeth from the active plan', () => {
  it('extraction worker: no spoken tooth + matched plan → card data carries the plan teeth', async () => {
    const setup = await createDoctorWithClinic(app);
    const seeded = await seedConsultation(app, setup.clinicId, setup.userId, {});
    await seedActivePlan(app, setup.clinicId, setup.userId, seeded.patientId, {
      procedure: 'RCT',
      teeth: [26],
      totalSittings: 4,
      completedSittings: 1,
    });
    await app.prisma.consultation.update({
      where: { id: seeded.consultationId },
      data: { rawTranscriptEnc: encryptField('continuing the RCT, second sitting done today') },
    });
    const job = await app.prisma.job.create({
      data: { clinicId: setup.clinicId, kind: 'EXTRACTION_CLINICAL', status: 'QUEUED', inputRef: seeded.consultationId },
    });

    await runExtractionJob(
      { prisma: app.prisma, extractor: new MockExtractor(), emit: () => undefined },
      { consultationId: seeded.consultationId, jobId: job.id, kind: 'CLINICAL' },
    );

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: seeded.consultationId } });
    const sd = consult.structuredData as { teeth?: number[]; continuesPlanId?: string | null };
    expect(sd.continuesPlanId).toBeTruthy();
    expect(sd.teeth).toEqual([26]); // inherited from the plan, not '—'
  });

  it('confirm: continuesPlanId with empty teeth persists the plan teeth on the record', async () => {
    const setup = await createDoctorWithClinic(app);
    const seeded = await seedConsultation(app, setup.clinicId, setup.userId, {});
    const { planId } = await seedActivePlan(app, setup.clinicId, setup.userId, seeded.patientId, {
      procedure: 'RCT',
      teeth: [26],
      totalSittings: 4,
      completedSittings: 1,
    });
    const data = {
      procedure: 'RCT',
      teeth: [] as number[],
      sittingCurrent: 2,
      sittingTotal: 4,
      continuesPlanId: planId,
      status: 'IN_PROGRESS' as const,
      prescriptions: [],
      followUp: null,
      toothStatusUpdates: [],
      notes: null,
      clarifications: [],
      safetyWarnings: [],
    };

    await commitConsultation(app.prisma, {
      consultationId: seeded.consultationId,
      structuredData: data,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: seeded.consultationId } });
    expect((consult.structuredData as { teeth?: number[] }).teeth).toEqual([26]);
  });
});
