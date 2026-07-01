import { Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { runAsSystem } from '../lib/request-context.js';
import { getSttProvider } from '../lib/stt/index.js';
import { getExtractor } from '../lib/ai/index.js';
import { storage } from '../lib/storage.js';
import {
  EXTRACTION_CONCURRENCY,
  EXTRACTION_QUEUE,
  STT_CONCURRENCY,
  STT_QUEUE,
  WHATSAPP_SEND_CONCURRENCY,
  WHATSAPP_SEND_QUEUE,
  createQueueConnection,
  enqueueExtractionJob,
  type WhatsAppSendJobData,
} from './index.js';
import { getWhatsAppProvider } from '../lib/whatsapp/index.js';
import { runWhatsAppSendJob } from '../lib/whatsapp/send.js';
import { publishConsultationEvent } from './events.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { clearRecording } from '../lib/realtime/recording.js';
import { runSttJob, type ExtractionKind, type SttDeps, type SttJobData } from './stt-worker.js';
import { runExtractionJob, type ExtractionDeps, type ExtractionJobData } from './extraction-worker.js';

const JOB_KIND: Record<ExtractionKind, 'EXTRACTION_CLINICAL' | 'EXTRACTION_PRESCRIPTION' | 'EXTRACTION_INTAKE'> = {
  CLINICAL: 'EXTRACTION_CLINICAL',
  PRESCRIPTION: 'EXTRACTION_PRESCRIPTION',
  INTAKE: 'EXTRACTION_INTAKE',
};

/**
 * Starts the in-process STT + extraction workers, wired to the app's prisma/redis/providers. Each
 * processor is a standalone function with injected deps (no Fastify request context), so this whole
 * file can move to a separate process in Phase 10 without touching business logic.
 */
export function startWorkers(app: FastifyInstance): { stop: () => Promise<void> } {
  const connection = createQueueConnection();
  const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;

  const sttDeps: SttDeps = {
    prisma: app.prisma,
    stt: getSttProvider(app.log),
    loadAudio: (key) => storage.getObject(key),
    emit: async (consultationId, event) => {
      await publishConsultationEvent(app.redis, consultationId, event);
    },
    enqueueExtraction: async ({ consultationId, kind }) => {
      // Create the extraction Job row (we're inside the STT worker's runAsSystem context), then enqueue.
      const consult = await app.prisma.consultation.findUnique({
        where: { id: consultationId },
        include: { visit: true },
      });
      if (!consult) return;
      const job = await app.prisma.job.create({
        data: { clinicId: consult.visit.clinicId, kind: JOB_KIND[kind], status: 'QUEUED', inputRef: consultationId },
      });
      await enqueueExtractionJob({ consultationId, jobId: job.id, kind });
    },
    logger: app.log,
  };

  const extractionDeps: ExtractionDeps = {
    prisma: app.prisma,
    extractor: getExtractor(app.log),
    emit: async (consultationId, event) => {
      await publishConsultationEvent(app.redis, consultationId, event);
    },
    logger: app.log,
    // Phase 4: pipeline settled → clear the "recording" set + tell the clinic's screens.
    onPipelineSettled: async ({ clinicId, visitId, doctorId }) => {
      await clearRecording(app.redis, clinicId, visitId);
      broadcastToClinic(clinicId, { type: 'doctor.recording.stopped', payload: { visitId, doctorId } });
    },
  };

  const sttWorker = new Worker<SttJobData>(
    STT_QUEUE,
    (job) => runAsSystem(() => runSttJob(sttDeps, job.data)),
    { connection: asConn(connection), concurrency: STT_CONCURRENCY },
  );
  const extractionWorker = new Worker<ExtractionJobData>(
    EXTRACTION_QUEUE,
    (job) => runAsSystem(() => runExtractionJob(extractionDeps, job.data)),
    { connection: asConn(connection), concurrency: EXTRACTION_CONCURRENCY },
  );

  const whatsappSendWorker = new Worker<WhatsAppSendJobData>(
    WHATSAPP_SEND_QUEUE,
    (job) =>
      runAsSystem(() =>
        runWhatsAppSendJob({ prisma: app.prisma, provider: getWhatsAppProvider(app.log), logger: app.log }, job.data.messageId),
      ),
    { connection: asConn(connection), concurrency: WHATSAPP_SEND_CONCURRENCY },
  );

  sttWorker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'STT worker job failed'));
  extractionWorker.on('failed', (job, err) =>
    app.log.error({ jobId: job?.id, err }, 'Extraction worker job failed'),
  );
  whatsappSendWorker.on('failed', (job, err) =>
    app.log.error({ jobId: job?.id, err }, 'WhatsApp send worker job failed'),
  );

  app.log.info(
    { sttConcurrency: STT_CONCURRENCY, extractionConcurrency: EXTRACTION_CONCURRENCY },
    'Voice pipeline workers started (in-process)',
  );

  return {
    stop: async () => {
      await sttWorker.close();
      await extractionWorker.close();
      await whatsappSendWorker.close();
      await connection.quit();
    },
  };
}
