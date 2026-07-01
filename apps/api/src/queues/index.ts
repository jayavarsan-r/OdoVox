import { Queue, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import type { ExtractionKind, SttJobData } from './stt-worker.js';
import type { ExtractionJobData } from './extraction-worker.js';

// BullMQ bundles its own ioredis; the app may resolve a different patch version. The runtime is
// identical, so we bridge the structural type skew at the (single) construction boundary.
const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;

/**
 * BullMQ queues. Concurrency is split by bottleneck: STT is gated by Sarvam (4), extraction by
 * Gemini rate limits (8). Connections are created lazily so importing this module (e.g. from the
 * routes) never opens Redis — only an actual enqueue (or a started worker) connects.
 *
 * NOTE (Phase 10): workers run in-process today (see start-workers.ts). The clean boundary —
 * standalone processors + injected deps + a dedicated connection — lets them split into their own
 * process later (`node dist/queues/standalone.js`) without touching business logic.
 */

// BullMQ disallows ':' in queue names (it's the Redis key-prefix separator).
export const STT_QUEUE = 'odovox-stt';
export const EXTRACTION_QUEUE = 'odovox-extraction';
export const WHATSAPP_SEND_QUEUE = 'odovox-whatsapp-send';
export const STT_CONCURRENCY = 4;
export const EXTRACTION_CONCURRENCY = 8;
export const WHATSAPP_SEND_CONCURRENCY = 4;

export interface WhatsAppSendJobData {
  messageId: string;
}

/** BullMQ requires `maxRetriesPerRequest: null` on its blocking connections. */
export function createQueueConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: null });
}

let sttQueue: Queue<SttJobData> | null = null;
let extractionQueue: Queue<ExtractionJobData> | null = null;
let whatsappSendQueue: Queue<WhatsAppSendJobData> | null = null;
let enqueueConnection: Redis | null = null;

function connection(): Redis {
  if (!enqueueConnection) enqueueConnection = createQueueConnection();
  return enqueueConnection;
}

export function getSttQueue(): Queue<SttJobData> {
  if (!sttQueue) sttQueue = new Queue<SttJobData>(STT_QUEUE, { connection: asConn(connection()) });
  return sttQueue;
}

export function getExtractionQueue(): Queue<ExtractionJobData> {
  if (!extractionQueue) {
    extractionQueue = new Queue<ExtractionJobData>(EXTRACTION_QUEUE, { connection: asConn(connection()) });
  }
  return extractionQueue;
}

/** Retry config: STT/extraction get 2 retries with exponential backoff (transient 5xx/rate limits). */
const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export async function enqueueSttJob(data: SttJobData): Promise<void> {
  await getSttQueue().add('stt', data, JOB_OPTS);
}

export async function enqueueExtractionJob(data: {
  consultationId: string;
  jobId: string;
  kind: ExtractionKind;
}): Promise<void> {
  await getExtractionQueue().add('extraction', data, JOB_OPTS);
}

export function getWhatsAppSendQueue(): Queue<WhatsAppSendJobData> {
  if (!whatsappSendQueue) {
    whatsappSendQueue = new Queue<WhatsAppSendJobData>(WHATSAPP_SEND_QUEUE, { connection: asConn(connection()) });
  }
  return whatsappSendQueue;
}

/** Phase 9: hand a PENDING WhatsApp message to the send worker (3× retry with backoff). */
export async function enqueueWhatsAppSend(data: WhatsAppSendJobData): Promise<void> {
  await getWhatsAppSendQueue().add('whatsapp-send', data, JOB_OPTS);
}

/** Graceful shutdown of the enqueue-side queues + connection. */
export async function closeQueues(): Promise<void> {
  await sttQueue?.close();
  await extractionQueue?.close();
  await whatsappSendQueue?.close();
  await enqueueConnection?.quit();
  sttQueue = null;
  extractionQueue = null;
  whatsappSendQueue = null;
  enqueueConnection = null;
}
