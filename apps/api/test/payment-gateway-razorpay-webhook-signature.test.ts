import { describe, expect, it } from 'vitest';
import { computeWebhookSignature } from '../src/lib/payments/signature.js';
import { RazorpayGateway } from '../src/lib/payments/razorpay-gateway.js';

const SECRET = 'whsec_test_razorpay';
const gw = new RazorpayGateway({ keyId: 'rzp_test_AB', keySecret: 'secret', webhookSecret: SECRET });
const payload = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: 'plink_1' } } } });

describe('Razorpay webhook signature verification', () => {
  it('accepts a correctly-signed payload', () => {
    const sig = computeWebhookSignature(payload, SECRET);
    expect(gw.verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it('rejects a tampered payload (signature no longer matches body)', () => {
    const sig = computeWebhookSignature(payload, SECRET);
    const tampered = payload.replace('plink_1', 'plink_HACKED');
    expect(gw.verifyWebhookSignature(tampered, sig)).toBe(false);
  });

  it('rejects a garbage / wrong-length signature without throwing', () => {
    expect(gw.verifyWebhookSignature(payload, 'not-a-real-signature')).toBe(false);
    expect(gw.verifyWebhookSignature(payload, '')).toBe(false);
    // signed with the wrong secret
    expect(gw.verifyWebhookSignature(payload, computeWebhookSignature(payload, 'wrong_secret'))).toBe(false);
  });
});
