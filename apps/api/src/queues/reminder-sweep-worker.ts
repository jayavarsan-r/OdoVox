import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { runAsSystem } from '../lib/request-context.js';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';
import type { SendOutcome, SendWhatsAppInput } from '../lib/whatsapp/send.js';
import { sendWhatsAppMessage } from '../lib/whatsapp/send.js';
import { whatsappSendDeps } from '../lib/whatsapp/deps.js';
import { createQueueConnection } from './index.js';

// BullMQ disallows ':' in queue names.
export const REMINDER_SWEEP_QUEUE = 'odovox-reminder-sweep';
export const REMINDER_SWEEP_JOB = 'reminder-sweep';
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export interface ReminderSweepDeps {
  prisma: ExtendedPrismaClient;
  /** The send pipeline — injected so a test can capture without a running send worker. */
  send: (input: SendWhatsAppInput) => Promise<SendOutcome>;
  now?: Date;
}

export interface ReminderSweepResult {
  appointmentSent: number;
  appointmentCancelled: number;
  billSent: number;
  billCancelled: number;
}

/** Format an appointment time in the clinic's timezone (e.g. "10:30 AM"). */
function formatApptTime(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  }
}

/**
 * Fire due appointment + outstanding-balance reminders. PENDING rows whose `scheduledFor` has passed
 * are handed to the send pipeline: a queued/deduped send marks the reminder SENT; a consent/template
 * block marks it CANCELLED with the reason (no perpetual retry). Cross-clinic → runs under a system
 * context. Clock-injectable (`now`) so a test drives it deterministically.
 */
export async function runReminderSweep(deps: ReminderSweepDeps): Promise<ReminderSweepResult> {
  const { prisma } = deps;
  const now = deps.now ?? new Date();
  const res: ReminderSweepResult = { appointmentSent: 0, appointmentCancelled: 0, billSent: 0, billCancelled: 0 };

  return runAsSystem(async () => {
    // --- Appointment reminders ---------------------------------------------
    const apptReminders = await prisma.appointmentReminder.findMany({
      where: { status: 'PENDING', scheduledFor: { lte: now } },
      include: { appointment: { include: { patient: true, clinic: { select: { name: true, timezone: true } } } } },
      take: 500,
    });

    for (const r of apptReminders) {
      const appt = r.appointment;
      if (!appt || appt.deletedAt || appt.status === 'CANCELLED' || appt.status === 'NO_SHOW') {
        await prisma.appointmentReminder.update({ where: { id: r.id }, data: { status: 'CANCELLED', errorReason: 'APPOINTMENT_INACTIVE' } });
        res.appointmentCancelled++;
        continue;
      }
      const variables: Record<string, string> = {
        1: appt.patient.name,
        2: appt.clinic.name,
        3: formatApptTime(appt.startsAt, appt.clinic.timezone),
      };
      const outcome = await deps.send({
        clinicId: r.clinicId,
        patientId: r.patientId,
        templateKey: r.template,
        variables,
        triggerType: r.template === 'appointment_reminder_1h' ? 'APPOINTMENT_REMINDER_1H' : 'APPOINTMENT_REMINDER_24H',
        triggerEntityType: 'Appointment',
        triggerEntityId: r.appointmentId,
        idempotencyKey: `appt_reminder:${r.id}`,
      });
      if (outcome.queued || outcome.deduped) {
        await prisma.appointmentReminder.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: now } });
        res.appointmentSent++;
      } else {
        await prisma.appointmentReminder.update({ where: { id: r.id }, data: { status: 'CANCELLED', errorReason: outcome.reason ?? 'BLOCKED' } });
        res.appointmentCancelled++;
      }
    }

    // --- Outstanding-balance reminders (Phase 8 BillReminder, type OUTSTANDING) ---------------
    const billReminders = await prisma.billReminder.findMany({
      where: { status: 'PENDING', type: 'OUTSTANDING', scheduledFor: { lte: now } },
      take: 500,
    });
    for (const r of billReminders) {
      const patient = await prisma.patient.findFirst({ where: { id: r.patientId, clinicId: r.clinicId } });
      const clinic = await prisma.clinic.findUnique({ where: { id: r.clinicId }, select: { name: true } });
      if (!patient || !clinic) {
        await prisma.billReminder.update({ where: { id: r.id }, data: { status: 'CANCELLED', errorReason: 'MISSING_ENTITY' } });
        res.billCancelled++;
        continue;
      }
      const outcome = await deps.send({
        clinicId: r.clinicId,
        patientId: r.patientId,
        templateKey: 'outstanding_balance_reminder',
        variables: { 1: patient.name, 2: (patient.outstandingPaise / 100).toFixed(2), 3: clinic.name },
        triggerType: 'OUTSTANDING_BALANCE_REMINDER',
        triggerEntityType: 'Bill',
        triggerEntityId: r.billId,
        idempotencyKey: `bill_reminder:${r.id}`,
      });
      if (outcome.queued || outcome.deduped) {
        await prisma.billReminder.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: now } });
        res.billSent++;
      } else {
        await prisma.billReminder.update({ where: { id: r.id }, data: { status: 'CANCELLED', errorReason: outcome.reason ?? 'BLOCKED' } });
        res.billCancelled++;
      }
    }

    return res;
  });
}

/**
 * Boot the repeating reminder sweep (every 5 min, concurrency 1). Started only from server start()
 * (never under tests — those drive runReminderSweep directly with a fake clock).
 */
export function startReminderCron(app: FastifyInstance): { stop: () => Promise<void> } {
  const connection = createQueueConnection();
  const asConn = (redis: Redis): ConnectionOptions => redis as unknown as ConnectionOptions;
  const queue = new Queue(REMINDER_SWEEP_QUEUE, { connection: asConn(connection) });

  void queue.add(REMINDER_SWEEP_JOB, {}, { repeat: { every: SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true });

  const worker = new Worker(
    REMINDER_SWEEP_QUEUE,
    () => runReminderSweep({ prisma: app.prisma, send: (input) => sendWhatsAppMessage(whatsappSendDeps(app), input) }),
    { connection: asConn(connection), concurrency: 1 },
  );
  worker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'Reminder sweep failed'));
  app.log.info({ everyMs: SWEEP_INTERVAL_MS }, 'WhatsApp reminder cron started (in-process)');

  return {
    stop: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
