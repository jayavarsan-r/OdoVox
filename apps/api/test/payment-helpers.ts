import type { FastifyInstance } from 'fastify';
import { authHeader, createDoctorWithClinic, createPatient, joinReceptionist } from './helpers.js';
import { computeWebhookSignature, MOCK_WEBHOOK_SECRET } from '../src/lib/payments/index.js';

/** A process-unique id suffix so webhook event ids never collide across test runs (the WebhookEvent
 *  (source, eventId) unique index persists in the shared dev DB between runs). */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Build, sign (with the mock webhook secret) and POST a Razorpay webhook event to the API. */
export function postRazorpayWebhook(
  app: FastifyInstance,
  opts: { eventId: string; eventType: string; linkId?: string; rzpPaymentId?: string; fee?: number; amount?: number; badSignature?: boolean },
) {
  const body = JSON.stringify({
    event: opts.eventType,
    payload: {
      ...(opts.linkId ? { payment_link: { entity: { id: opts.linkId } } } : {}),
      payment: { entity: { id: opts.rzpPaymentId ?? 'pay_test_1', fee: opts.fee ?? 0, amount: opts.amount ?? 0 } },
    },
  });
  const signature = opts.badSignature ? 'deadbeef' : computeWebhookSignature(body, MOCK_WEBHOOK_SECRET);
  return app.inject({
    method: 'POST',
    url: '/webhooks/razorpay',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': opts.eventId },
    payload: body,
  });
}

/** Create a clinic + receptionist + patient, and a FINALIZED bill of `totalPaise`. */
export async function finalizedBill(app: FastifyInstance, totalPaise = 1000000) {
  const doctor = await createDoctorWithClinic(app);
  const recp = await joinReceptionist(app, doctor.joinCode);
  const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
  const created = await app.inject({
    method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
    payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: totalPaise }] },
  });
  const billId = created.json().data.id;
  await app.inject({ method: 'POST', url: `/bills/${billId}/finalize`, headers: authHeader(recp.accessToken) });
  return { doctor, recp, patientId, billId, totalPaise };
}

/** Create a finalized bill and pay it (cash) for `amountPaise`. Returns the cash paymentId. */
export async function paidBill(app: FastifyInstance, totalPaise = 350000, payPaise = totalPaise, key = 'paid-bill-key-1') {
  const ctx = await finalizedBill(app, totalPaise);
  const res = await app.inject({
    method: 'POST', url: '/payments/cash', headers: authHeader(ctx.recp.accessToken),
    payload: { billId: ctx.billId, amountPaise: payPaise, idempotencyKey: key },
  });
  return { ...ctx, payRes: res, paymentId: res.json().data.id as string };
}

/** Create a Razorpay payment link for `amountPaise` against a fresh finalized bill. */
export async function razorpayLink(app: FastifyInstance, totalPaise = 350000, amountPaise = totalPaise, key = 'rzp-link-key-1') {
  const ctx = await finalizedBill(app, totalPaise);
  const res = await app.inject({
    method: 'POST', url: '/payments/razorpay/link', headers: authHeader(ctx.recp.accessToken),
    payload: { billId: ctx.billId, amountPaise, idempotencyKey: key },
  });
  return { ...ctx, linkRes: res, paymentId: res.json().data?.paymentId as string };
}
