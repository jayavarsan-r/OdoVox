import { describe, expect, it } from 'vitest';
import { buildRefundPayload } from '../src/lib/payments/razorpay-gateway.js';

describe('Razorpay refund payload', () => {
  it('sends the refund amount in paise with normal speed', () => {
    const p = buildRefundPayload(50000) as Record<string, unknown>;
    expect(p.amount).toBe(50000);
    expect(p.speed).toBe('normal');
    expect(p.notes).toBeUndefined();
  });

  it('attaches notes when provided (echoed back by Razorpay on the refund webhook)', () => {
    const p = buildRefundPayload(50000, { refundId: 'RF-SM1', reason: 'procedure revised' }) as Record<string, unknown>;
    expect(p.amount).toBe(50000);
    expect(p.notes).toEqual({ refundId: 'RF-SM1', reason: 'procedure revised' });
  });
});
