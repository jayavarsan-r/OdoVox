import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { MockSttProvider } from '../src/lib/stt/index.js';
import { MockExtractor } from '../src/lib/ai/index.js';
import { decryptField } from '../src/lib/encryption.js';
import { runSttJob, type SttDeps } from '../src/queues/stt-worker.js';
import { runExtractionJob, type ExtractionDeps } from '../src/queues/extraction-worker.js';
import type { ConsultationEvent } from '../src/queues/events.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const TRANSCRIPT =
  'RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.';

async function setupAudioConsultation() {
  const setup = await createDoctorWithClinic(app);
  const { consultationId, visitId } = await seedConsultation(app, setup.clinicId, setup.userId, {});
  await app.prisma.consultation.update({
    where: { id: consultationId },
    data: { audioStorageKey: `clinics/${setup.clinicId}/audio/${consultationId}.webm` },
  });
  const sttJob = await app.prisma.job.create({
    data: { clinicId: setup.clinicId, kind: 'STT', status: 'QUEUED', inputRef: consultationId },
  });
  return { setup, consultationId, visitId, sttJobId: sttJob.id };
}

describe('voice pipeline — STT worker', () => {
  it('transcribes, encrypts the transcript, marks the job SUCCEEDED, and enqueues extraction', async () => {
    const { consultationId, sttJobId } = await setupAudioConsultation();
    const events: ConsultationEvent[] = [];
    const enqueued: { consultationId: string }[] = [];

    const deps: SttDeps = {
      prisma: app.prisma,
      stt: new MockSttProvider({ latencyMs: 0 }),
      loadAudio: async () => Buffer.from(`MOCK_TRANSCRIPT:${TRANSCRIPT}`),
      emit: (_cid, ev) => void events.push(ev),
      enqueueExtraction: async (d) => void enqueued.push(d),
    };

    await runSttJob(deps, { consultationId, jobId: sttJobId });

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(consult.rawTranscriptEnc).toBeTruthy();
    expect(decryptField(consult.rawTranscriptEnc!)).toBe(TRANSCRIPT);
    expect(consult.languageCode).toBe('en-IN');
    expect(consult.sttLatencyMs).toBeGreaterThanOrEqual(0);

    const job = await app.prisma.job.findUniqueOrThrow({ where: { id: sttJobId } });
    expect(job.status).toBe('SUCCEEDED');

    expect(events.map((e) => e.type)).toEqual(['TRANSCRIBING', 'TRANSCRIBED']);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]!.consultationId).toBe(consultationId);
  });

  it('marks the job FAILED and emits FAILED when STT throws', async () => {
    const { consultationId, sttJobId } = await setupAudioConsultation();
    const events: ConsultationEvent[] = [];
    const deps: SttDeps = {
      prisma: app.prisma,
      stt: { transcribe: async () => { throw new Error('sarvam down'); } },
      loadAudio: async () => Buffer.from('x'),
      emit: (_cid, ev) => void events.push(ev),
      enqueueExtraction: async () => undefined,
    };

    await expect(runSttJob(deps, { consultationId, jobId: sttJobId })).rejects.toThrow(/sarvam down/);

    const job = await app.prisma.job.findUniqueOrThrow({ where: { id: sttJobId } });
    expect(job.status).toBe('FAILED');
    expect(job.lastError).toMatch(/sarvam down/);
    expect(events.some((e) => e.type === 'FAILED')).toBe(true);
  });
});

describe('voice pipeline — extraction worker', () => {
  it('decrypts the transcript, extracts structured data, runs safety, and emits READY', async () => {
    const { setup, consultationId, sttJobId } = await setupAudioConsultation();
    // First run STT so a transcript exists.
    await runSttJob(
      {
        prisma: app.prisma,
        stt: new MockSttProvider({ latencyMs: 0 }),
        loadAudio: async () => Buffer.from(`MOCK_TRANSCRIPT:${TRANSCRIPT}`),
        emit: () => undefined,
        enqueueExtraction: async () => undefined,
      },
      { consultationId, jobId: sttJobId },
    );

    const extJob = await app.prisma.job.create({
      data: { clinicId: setup.clinicId, kind: 'EXTRACTION_CLINICAL', status: 'QUEUED', inputRef: consultationId },
    });
    const events: ConsultationEvent[] = [];
    const deps: ExtractionDeps = {
      prisma: app.prisma,
      extractor: new MockExtractor(),
      emit: (_cid, ev) => void events.push(ev),
    };

    await runExtractionJob(deps, { consultationId, jobId: extJob.id, kind: 'CLINICAL' });

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    const sd = consult.structuredData as { procedure?: string; teeth?: number[] };
    expect(sd.procedure).toBe('RCT');
    expect(sd.teeth).toContain(26);
    expect(consult.status).toBe('PENDING_REVIEW');
    expect(consult.extractionLatencyMs).toBeGreaterThanOrEqual(0);

    const job = await app.prisma.job.findUniqueOrThrow({ where: { id: extJob.id } });
    expect(job.status).toBe('SUCCEEDED');

    expect(events.map((e) => e.type)).toEqual(['EXTRACTING', 'READY']);
  });

  it('flags an allergy conflict in the safety layer (penicillin allergy + Amoxicillin)', async () => {
    const setup = await createDoctorWithClinic(app);
    const { encryptField } = await import('../src/lib/encryption.js');
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, {}, {
      allergiesEnc: encryptField('Penicillin'),
    });
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { rawTranscriptEnc: encryptField(TRANSCRIPT) },
    });
    const extJob = await app.prisma.job.create({
      data: { clinicId: setup.clinicId, kind: 'EXTRACTION_CLINICAL', status: 'QUEUED', inputRef: consultationId },
    });

    await runExtractionJob(
      { prisma: app.prisma, extractor: new MockExtractor(), emit: () => undefined },
      { consultationId, jobId: extJob.id, kind: 'CLINICAL' },
    );

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(consult.safetyWarnings.some((w) => w.startsWith('allergy_conflict'))).toBe(true);
  });
});
