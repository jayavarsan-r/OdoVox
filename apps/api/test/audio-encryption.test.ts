import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { MockSttProvider } from '../src/lib/stt/index.js';
import { decryptField } from '../src/lib/encryption.js';
import { runSttJob } from '../src/queues/stt-worker.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const TRANSCRIPT = 'Extraction of 38 completed. Paracetamol 500mg SOS for pain.';

describe('transcript encryption at rest', () => {
  it('stores the raw transcript as opaque ciphertext (no plaintext leaks into the DB)', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, {});
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { audioStorageKey: `clinics/${setup.clinicId}/audio/${consultationId}.webm` },
    });
    const sttJob = await app.prisma.job.create({
      data: { clinicId: setup.clinicId, kind: 'STT', status: 'QUEUED', inputRef: consultationId },
    });

    await runSttJob(
      {
        prisma: app.prisma,
        stt: new MockSttProvider({ latencyMs: 0 }),
        loadAudio: async () => Buffer.from(`MOCK_TRANSCRIPT:${TRANSCRIPT}`),
        emit: () => undefined,
        enqueueExtraction: async () => undefined,
      },
      { consultationId, jobId: sttJob.id },
    );

    // Read the raw column straight from the DB — it must NOT contain the plaintext.
    const [row] = await app.prisma.$queryRawUnsafe<{ rawTranscriptEnc: string }[]>(
      `SELECT "rawTranscriptEnc" FROM "Consultation" WHERE id = $1`,
      consultationId,
    );
    expect(row!.rawTranscriptEnc).not.toContain('Extraction');
    expect(row!.rawTranscriptEnc).not.toContain('Paracetamol');
  });

  it('round-trips: the stored ciphertext decrypts back to the original transcript', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, {});
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { audioStorageKey: `clinics/${setup.clinicId}/audio/${consultationId}.webm` },
    });
    const sttJob = await app.prisma.job.create({
      data: { clinicId: setup.clinicId, kind: 'STT', status: 'QUEUED', inputRef: consultationId },
    });

    await runSttJob(
      {
        prisma: app.prisma,
        stt: new MockSttProvider({ latencyMs: 0 }),
        loadAudio: async () => Buffer.from(`MOCK_TRANSCRIPT:${TRANSCRIPT}`),
        emit: () => undefined,
        enqueueExtraction: async () => undefined,
      },
      { consultationId, jobId: sttJob.id },
    );

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(decryptField(consult.rawTranscriptEnc!)).toBe(TRANSCRIPT);
  });
});
