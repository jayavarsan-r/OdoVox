import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import type { ScheduleAppointment } from '@odovox/types';
import { runAsSystem } from '../lib/request-context.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { APPOINTMENT_INCLUDE, serializeAppointment } from '../lib/schedule/serialize.js';
import { createQueueConnection } from './index.js';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';

// BullMQ disallows ':' in queue names.
export const SCHEDULE_CRON_QUEUE = 'odovox-schedule-cron';
export const NO_SHOW_JOB = 'no-show-sweep';
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MINUTE_MS = 60_000;

export interface NoShowSweepDeps {
  prisma: ExtendedPrismaClient;
  now?: Date;
  /** Called once per marked appointment, after commit (for the Socket.IO broadcast). */
  onMarked?: (clinicId: string, payload: ScheduleAppointment) => void;
}

/**
 * Mark past-due SCHEDULED appointments as NO_SHOW once their clinic's grace window has elapsed.
 * Pure of any clock: pass `now` to drive it deterministically from a test. Runs cross-clinic, so it
 * executes under a system context (scope bypassed); audit + broadcast are attributed per clinic.
 */
export async function runNoShowSweep(deps: NoShowSweepDeps): Promise<{ marked: number; ids: string[] }> {
  const { prisma } = deps;
  const now = deps.now ?? new Date();
  return runAsSystem(async () => {
    const candidates = await prisma.appointment.findMany({
      where: { status: 'SCHEDULED', deletedAt: null, startsAt: { lt: now } },
      include: { ...APPOINTMENT_INCLUDE, clinic: { select: { noShowGraceMinutes: true } } },
    });
    const due = candidates.filter(
      (a) => a.startsAt.getTime() + a.clinic.noShowGraceMinutes * MINUTE_MS < now.getTime(),
    );

    const ids: string[] = [];
    for (const a of due) {
      await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: a.id }, data: { status: 'NO_SHOW', noShowAt: now } });
        await tx.appointmentReminder.updateMany({
          where: { appointmentId: a.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      });
      await prisma.auditLog.create({
        data: {
          clinicId: a.clinicId,
          action: 'APPOINTMENT_NO_SHOW_AUTO',
          entityType: 'Appointment',
          entityId: a.id,
          metadata: { graceMinutes: a.clinic.noShowGraceMinutes },
        },
      });
      deps.onMarked?.(a.clinicId, serializeAppointment({ ...a, status: 'NO_SHOW' }));
      ids.push(a.id);
    }
    return { marked: due.length, ids };
  });
}

/**
 * Boot the repeating NO_SHOW sweep (every 5 min, concurrency 1). Started only from server `start()`
 * (i.e. never under tests, which import buildServer without calling start) — tests drive
 * `runNoShowSweep` directly with a fake clock.
 */
export function startScheduleCron(app: FastifyInstance): { stop: () => Promise<void> } {
  const connection = createQueueConnection();
  const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;
  const queue = new Queue(SCHEDULE_CRON_QUEUE, { connection: asConn(connection) });

  void queue.add(
    NO_SHOW_JOB,
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true },
  );

  const worker = new Worker(
    SCHEDULE_CRON_QUEUE,
    () =>
      runNoShowSweep({
        prisma: app.prisma,
        onMarked: (clinicId, payload) =>
          broadcastToClinic(clinicId, { type: 'schedule.appointment.no_show', payload }),
      }),
    { connection: asConn(connection), concurrency: 1 },
  );
  worker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'NO_SHOW sweep failed'));
  app.log.info({ everyMs: SWEEP_INTERVAL_MS }, 'Schedule NO_SHOW cron started (in-process)');

  return {
    stop: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
