import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { runAsSystem } from '../lib/request-context.js';
import { sendLabTemplate } from '../lib/lab-transport/send-service.js';
import { createQueueConnection } from './index.js';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';

// BullMQ disallows ':' in queue names.
export const LAB_TIMEOUT_QUEUE = 'odovox-lab-timeouts';
export const LAB_TIMEOUT_JOB = 'lab-timeout-sweep';
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LabTimeoutSweepDeps {
  prisma: ExtendedPrismaClient;
  now?: Date;
}

/**
 * Phase 9.7 §2.10 — the lab timeout sweep. NEVER changes case status (the transition service
 * rejects timeout_job outright); it only sends T2 status nudges, gated by:
 *   - consent (no consentLoggedAt → no send, inside sendLabTemplate)
 *   - automationPaused (per-lab kill switch, inside sendLabTemplate)
 *   - max ONE automated nudge per case per 24h (relationship > automation)
 * Conditions swept: SENT unacknowledged 24h (nudge_ack), due tomorrow and not READY
 * (pre_due_check), past expected date and not READY (overdue). In-app alerts for stuck_ready /
 * issue_stale come from /home/needs-you (computed on read — no jobs needed).
 */
export async function runLabTimeoutSweep(deps: LabTimeoutSweepDeps): Promise<{ nudged: string[] }> {
  const { prisma } = deps;
  const now = deps.now ?? new Date();
  return runAsSystem(async () => {
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const dayAhead = new Date(now.getTime() + DAY_MS);

    const [unacked, dueSoonOrOverdue] = await Promise.all([
      // nudge_ack — sent but silent for 24h.
      prisma.labCase.findMany({
        where: { status: 'SENT', statusUpdatedAt: { lt: dayAgo }, vendorId: { not: null } },
        select: { id: true, clinicId: true, vendorId: true },
      }),
      // pre_due_check + overdue — expected by tomorrow (or already past), work not READY yet.
      prisma.labCase.findMany({
        where: {
          status: { in: ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
          expectedReturnAt: { lt: dayAhead },
          vendorId: { not: null },
        },
        select: { id: true, clinicId: true, vendorId: true },
      }),
    ]);

    const candidates = new Map<string, { id: string; clinicId: string; vendorId: string }>();
    for (const c of [...unacked, ...dueSoonOrOverdue]) {
      candidates.set(c.id, { id: c.id, clinicId: c.clinicId, vendorId: c.vendorId! });
    }

    const nudged: string[] = [];
    for (const c of candidates.values()) {
      // Hard cap: one automated nudge per case per 24h.
      const recent = await prisma.labMessage.findFirst({
        where: { clinicId: c.clinicId, labCaseId: c.id, templateKey: 'lab_t2_nudge', createdAt: { gt: dayAgo } },
      });
      if (recent) continue;
      const result = await sendLabTemplate(prisma, {
        clinicId: c.clinicId,
        vendorId: c.vendorId,
        caseId: c.id,
        templateKey: 'lab_t2_nudge',
        automated: true,
      });
      if (result.sent) nudged.push(c.id);
    }
    return { nudged };
  });
}

/** Boot the repeating sweep (every 15 min). Started only from server start() — never under tests. */
export function startLabTimeoutCron(app: FastifyInstance): { stop: () => Promise<void> } {
  const connection = createQueueConnection();
  const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;
  const queue = new Queue(LAB_TIMEOUT_QUEUE, { connection: asConn(connection) });

  void queue.add(LAB_TIMEOUT_JOB, {}, { repeat: { every: SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true });

  const worker = new Worker(LAB_TIMEOUT_QUEUE, () => runLabTimeoutSweep({ prisma: app.prisma }), {
    connection: asConn(connection),
    concurrency: 1,
  });
  worker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'Lab timeout sweep failed'));
  app.log.info({ everyMs: SWEEP_INTERVAL_MS }, 'Lab timeout sweep started (in-process)');

  return {
    stop: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
