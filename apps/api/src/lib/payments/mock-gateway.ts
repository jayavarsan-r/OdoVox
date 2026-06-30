import { createHash } from 'node:crypto';
import type {
  CaptureResult,
  IPaymentGateway,
  PaymentLinkInput,
  PaymentLinkResult,
  RefundResult,
} from './gateway.js';
import { computeWebhookSignature, verifyWebhookSignature } from './signature.js';

export const MOCK_WEBHOOK_SECRET = 'mock_razorpay_webhook_secret';
const RAZORPAY_FEE_BPS = 200; // 2% — mirrors Razorpay's standard cut, paise

/** Deterministic 0..1 fraction from a string — lets the chaos knob be reproducible in tests. */
function hashFraction(input: string): number {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

/** Short deterministic id suffix so the same reference always yields the same mock link/payment. */
function idFor(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 14);
}

export interface MockGatewayOptions {
  /** Fraction (0..1) of captures that simulate a FAILED payment. Default 0 (always succeed). */
  failureRate?: number;
  webhookSecret?: string;
}

/**
 * Deterministic in-memory payment gateway. No network, no Razorpay account. Same reference always
 * produces the same link/payment/refund ids, so tests can assert exact values. `failureRate` makes
 * `capturePayment` return a FAILED status for a reproducible subset of payment ids (chaos testing).
 */
export class MockPaymentGateway implements IPaymentGateway {
  readonly label = 'mock';
  private readonly failureRate: number;
  private readonly webhookSecret: string;

  constructor(opts: MockGatewayOptions = {}) {
    this.failureRate = Math.min(1, Math.max(0, opts.failureRate ?? 0));
    this.webhookSecret = opts.webhookSecret ?? MOCK_WEBHOOK_SECRET;
  }

  async createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    const suffix = idFor(input.referenceId);
    return {
      linkId: `plink_mock_${suffix}`,
      orderId: `order_mock_${suffix}`,
      shortUrl: `https://mock-razorpay/link/${suffix}`,
      status: 'created',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature, this.webhookSecret);
  }

  /** Sign a payload with the mock secret — used by the webhook simulator to forge valid events. */
  signWebhook(payload: string): string {
    return computeWebhookSignature(payload, this.webhookSecret);
  }

  async capturePayment(paymentId: string, amountPaise: number): Promise<CaptureResult> {
    const failed = hashFraction(paymentId) < this.failureRate;
    return {
      paymentId,
      status: failed ? 'failed' : 'captured',
      feePaise: failed ? 0 : Math.round((amountPaise * RAZORPAY_FEE_BPS) / 10_000),
    };
  }

  async refund(paymentId: string, _amountPaise: number): Promise<RefundResult> {
    return { refundId: `rfnd_mock_${idFor(paymentId)}`, status: 'processed' };
  }
}
