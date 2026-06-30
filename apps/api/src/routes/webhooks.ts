import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AppError, NotFoundError } from '../lib/errors.js';
import { ok } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { loadEnv } from '../lib/env.js';
import { getPaymentGateway } from '../lib/payments/index.js';
import { processRazorpayWebhook } from '../lib/billing/webhook-service.js';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;

  // Scoped JSON parser that keeps the raw body string — Razorpay's HMAC is over the exact bytes.
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = typeof body === 'string' ? body : body.toString('utf8');
    try {
      done(null, req.rawBody.length ? JSON.parse(req.rawBody) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const RATE = { config: { rateLimit: { max: 100, timeWindow: 60_000 } } };

  // POST /webhooks/razorpay — no JWT; authenticity is the HMAC signature.
  fastify.post('/webhooks/razorpay', RATE, async (req, reply) => {
    const raw = req.rawBody ?? '';
    const signature = (req.headers['x-razorpay-signature'] as string | undefined) ?? '';
    const gateway = getPaymentGateway(req.log);
    if (!gateway.verifyWebhookSignature(raw, signature)) {
      await fastify.audit('WEBHOOK_SIGNATURE_INVALID', 'WebhookEvent', null, { source: 'razorpay' });
      reply.status(401);
      return { ok: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } };
    }
    const body = (req.body ?? {}) as { event?: string; payload?: Record<string, unknown> };
    const eventType = body.event ?? 'unknown';
    // Razorpay sends the event id in a header; fall back to a content hash so dedup still holds.
    const eventId =
      (req.headers['x-razorpay-event-id'] as string | undefined) ?? createHash('sha256').update(raw).digest('hex');

    const result = await processRazorpayWebhook(prisma, {
      eventId,
      eventType,
      payload: body.payload ?? {},
      signature,
      signatureValid: true,
    });
    await fastify.audit('WEBHOOK_RECEIVED', 'WebhookEvent', eventId, { source: 'razorpay', eventType, outcome: result.outcome });
    return ok({ received: true, outcome: result.outcome });
  });

  // Non-prod only: simulate a successful Razorpay payment for a PENDING link, for local testing
  // without a real Razorpay account. DOCTOR/ADMIN only.
  fastify.post(
    '/webhooks/razorpay/mock-trigger/:paymentId',
    { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] },
    async (req) => {
      if (loadEnv().NODE_ENV === 'production') {
        throw new AppError('Mock webhook trigger is disabled in production', 403, 'MOCK_DISABLED');
      }
      const { paymentId } = req.params as { paymentId: string };
      const payment = await prisma.payment.findFirst({ where: { id: paymentId, clinicId: req.clinicId! } });
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.method !== 'RAZORPAY') throw new AppError('Not a Razorpay payment', 422, 'NOT_RAZORPAY');

      const fee = Math.round((payment.amountPaise * 200) / 10_000); // mock 2%
      const result = await processRazorpayWebhook(prisma, {
        eventId: `evt_mock_${payment.id}_${Date.now()}`,
        eventType: 'payment_link.paid',
        payload: {
          payment_link: { entity: { id: payment.razorpayLinkId ?? `plink_${payment.id}` } },
          payment: { entity: { id: `pay_mock_${payment.id}`, fee, amount: payment.amountPaise } },
        },
        signature: 'mock-trigger',
        signatureValid: true,
      });
      await fastify.audit('WEBHOOK_MOCK_TRIGGERED', 'Payment', payment.id, { outcome: result.outcome });
      return ok({ outcome: result.outcome, paymentId: payment.id });
    },
  );
}
