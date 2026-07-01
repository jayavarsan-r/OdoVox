import type { FastifyInstance } from 'fastify';
import { enqueueWhatsAppSend } from '../../queues/index.js';
import { getWhatsAppProvider } from './index.js';
import type { SendDeps } from './send.js';

/**
 * Build the send-pipeline deps from a Fastify instance — used by routes, cross-wires (lab/payment),
 * and the reminder cron. The provider is env-selected; enqueue hands the PENDING row to the BullMQ
 * send worker; audit records consent/budget blocks.
 */
export function whatsappSendDeps(fastify: FastifyInstance): SendDeps {
  return {
    prisma: fastify.prisma,
    provider: getWhatsAppProvider(fastify.log),
    enqueue: (messageId) => enqueueWhatsAppSend({ messageId }),
    audit: (action, entityType, entityId, metadata) => fastify.audit(action, entityType, entityId, metadata),
    logger: fastify.log,
  };
}
