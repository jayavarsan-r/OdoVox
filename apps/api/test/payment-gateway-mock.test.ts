import { describe, expect, it } from 'vitest';
import { MockPaymentGateway } from '../src/lib/payments/mock-gateway.js';
import type { PaymentLinkInput } from '../src/lib/payments/gateway.js';

const input: PaymentLinkInput = {
  amountPaise: 350000,
  referenceId: 'PAY-SMABC123',
  description: 'Bill BL-SM1A2B',
  customer: { name: 'Akhilesh', contact: '+919876543210' },
  notify: 'whatsapp',
};

describe('MockPaymentGateway', () => {
  it('is deterministic — same reference yields the same link + short url', async () => {
    const gw = new MockPaymentGateway();
    const a = await gw.createPaymentLink(input);
    const b = await gw.createPaymentLink(input);
    expect(a).toEqual(b);
    expect(a.linkId).toMatch(/^plink_mock_/);
    expect(a.shortUrl).toContain('mock-razorpay/link/');
    expect(a.status).toBe('created');
  });

  it('captures successfully with a 2% fee by default (failureRate 0)', async () => {
    const gw = new MockPaymentGateway();
    const cap = await gw.capturePayment('pay_mock_x', 350000);
    expect(cap.status).toBe('captured');
    expect(cap.feePaise).toBe(7000); // 2% of 350000
  });

  it('honours the configurable failure rate — 1.0 always fails, 0 never does', async () => {
    const always = new MockPaymentGateway({ failureRate: 1 });
    const never = new MockPaymentGateway({ failureRate: 0 });
    const failed = await always.capturePayment('pay_mock_x', 100000);
    const ok = await never.capturePayment('pay_mock_x', 100000);
    expect(failed.status).toBe('failed');
    expect(failed.feePaise).toBe(0);
    expect(ok.status).toBe('captured');
  });
});
