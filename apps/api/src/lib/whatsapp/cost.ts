import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { runAsSystem } from '../../lib/request-context.js';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { createQueueConnection } from '../../queues/index.js';

export const COST_CRON_QUEUE = 'odovox-whatsapp-cost';
export const COST_CRON_JOB = 'whatsapp-cost-aggregate';
const DAILY_MS = 24 * 60 * 60 * 1000;

/** UTC [start, end) bounds for a given month. */
export function monthBounds(year: number, month: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

/**
 * Recompute the per-clinic WhatsApp cost rollup for one month from the message log. Counts every
 * outbound conversation that actually left the building (SENT/DELIVERED/READ), split by the
 * template's billing category, and upserts one WhatsAppCostLog row per clinic. Idempotent.
 */
export async function runCostAggregation(
  prisma: ExtendedPrismaClient,
  opts: { year: number; month: number } = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 },
): Promise<{ clinics: number }> {
  const { year, month } = opts;
  const bounds = monthBounds(year, month);
  return runAsSystem(async () => {
    const messages = await prisma.whatsAppMessage.findMany({
      where: { direction: 'OUTBOUND', status: { in: ['SENT', 'DELIVERED', 'READ'] }, createdAt: bounds },
      select: { clinicId: true, costPaise: true, template: { select: { category: true } } },
    });

    const byClinic = new Map<string, { total: number; utility: number; service: number; marketing: number; count: number }>();
    for (const m of messages) {
      const agg = byClinic.get(m.clinicId) ?? { total: 0, utility: 0, service: 0, marketing: 0, count: 0 };
      agg.total += m.costPaise;
      agg.count += 1;
      const cat = m.template?.category;
      if (cat === 'UTILITY') agg.utility += 1;
      else if (cat === 'SERVICE') agg.service += 1;
      else if (cat === 'MARKETING') agg.marketing += 1;
      byClinic.set(m.clinicId, agg);
    }

    for (const [clinicId, agg] of byClinic) {
      await prisma.whatsAppCostLog.upsert({
        where: { clinicId_year_month: { clinicId, year, month } },
        update: {
          conversationsCount: agg.count,
          utilityCount: agg.utility,
          serviceCount: agg.service,
          marketingCount: agg.marketing,
          totalCostPaise: agg.total,
          computedAt: new Date(),
        },
        create: {
          clinicId,
          year,
          month,
          conversationsCount: agg.count,
          utilityCount: agg.utility,
          serviceCount: agg.service,
          marketingCount: agg.marketing,
          totalCostPaise: agg.total,
        },
      });
    }
    return { clinics: byClinic.size };
  });
}

/** Boot the daily cost-aggregation cron. Started only from server start() (never under tests). */
export function startCostCron(app: FastifyInstance): { stop: () => Promise<void> } {
  const connection = createQueueConnection();
  const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;
  const queue = new Queue(COST_CRON_QUEUE, { connection: asConn(connection) });
  void queue.add(COST_CRON_JOB, {}, { repeat: { every: DAILY_MS }, removeOnComplete: true, removeOnFail: true });
  const worker = new Worker(COST_CRON_QUEUE, () => runCostAggregation(app.prisma), { connection: asConn(connection), concurrency: 1 });
  worker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'WhatsApp cost aggregation failed'));
  app.log.info({ everyMs: DAILY_MS }, 'WhatsApp cost cron started (in-process)');
  return {
    stop: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
