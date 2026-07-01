import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { finalizedBill } from './payment-helpers.js';
import { optIn, seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Cross-wire: payment success → payment_receipt send', () => {
  it('creates a PENDING payment_receipt message after a cash payment (consented patient)', async () => {
    const ctx = await finalizedBill(app, 350000);
    await seedTemplate(app, ctx.doctor.clinicId, 'payment_receipt', {
      body: 'Thank you {{1}} for your payment of ₹{{2}}. Receipt #{{3}}.',
      variables: ['patient_name', 'amount', 'receipt_number'],
    });
    await optIn(app, ctx.doctor.clinicId, ctx.patientId);

    const pay = await app.inject({
      method: 'POST',
      url: '/payments/cash',
      headers: authHeader(ctx.recp.accessToken),
      payload: { billId: ctx.billId, amountPaise: 350000, idempotencyKey: 'receipt-xw-1' },
    });
    expect(pay.statusCode).toBe(201);
    const paymentId = pay.json().data.id;

    const msg = await app.prisma.whatsAppMessage.findFirst({
      where: { clinicId: ctx.doctor.clinicId, triggerType: 'PAYMENT_RECEIPT', triggerEntityId: paymentId },
    });
    expect(msg).not.toBeNull();
    expect(msg!.idempotencyKey).toBe(`receipt:${paymentId}`);
    expect(msg!.body).toContain('3500.00');
  });

  it('does not double-send the receipt on an idempotent payment replay', async () => {
    const ctx = await finalizedBill(app, 200000);
    await seedTemplate(app, ctx.doctor.clinicId, 'payment_receipt');
    await optIn(app, ctx.doctor.clinicId, ctx.patientId);
    const payload = { billId: ctx.billId, amountPaise: 200000, idempotencyKey: 'receipt-xw-2' };
    await app.inject({ method: 'POST', url: '/payments/cash', headers: authHeader(ctx.recp.accessToken), payload });
    await app.inject({ method: 'POST', url: '/payments/cash', headers: authHeader(ctx.recp.accessToken), payload });

    const count = await app.prisma.whatsAppMessage.count({
      where: { clinicId: ctx.doctor.clinicId, triggerType: 'PAYMENT_RECEIPT' },
    });
    expect(count).toBe(1);
  });
});
