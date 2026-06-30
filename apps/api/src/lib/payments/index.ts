import { loadEnv } from '../env.js';
import type { IPaymentGateway } from './gateway.js';
import { MockPaymentGateway } from './mock-gateway.js';
import { RazorpayGateway, type PaymentLogger } from './razorpay-gateway.js';

export type {
  IPaymentGateway,
  PaymentLinkInput,
  PaymentLinkResult,
  PaymentLinkNotify,
  CaptureResult,
  RefundResult,
} from './gateway.js';
export { MockPaymentGateway, MOCK_WEBHOOK_SECRET } from './mock-gateway.js';
export {
  RazorpayGateway,
  buildPaymentLinkPayload,
  buildRefundPayload,
  type PaymentLogger,
} from './razorpay-gateway.js';
export { computeWebhookSignature, verifyWebhookSignature } from './signature.js';

let cached: IPaymentGateway | null = null;

/**
 * Returns the payment gateway selected by PAYMENT_PROVIDER. Defaults to the deterministic mock so
 * dev and tests never hit (or pay) the real Razorpay API. The mock's chaos knob comes from
 * PAYMENT_MOCK_FAILURE_RATE. Memoised per process (cleared via resetPaymentGateway in tests).
 */
export function getPaymentGateway(logger?: PaymentLogger): IPaymentGateway {
  if (cached) return cached;
  const env = loadEnv();
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    cached = new RazorpayGateway(
      {
        keyId: env.RAZORPAY_KEY_ID!,
        keySecret: env.RAZORPAY_KEY_SECRET!,
        webhookSecret: env.RAZORPAY_WEBHOOK_SECRET!,
        mode: env.RAZORPAY_MODE,
      },
      logger,
    );
  } else {
    cached = new MockPaymentGateway({
      failureRate: env.PAYMENT_MOCK_FAILURE_RATE,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    });
  }
  return cached;
}

/** Test seam — drop the memoised gateway so a test can re-read env. */
export function resetPaymentGateway(): void {
  cached = null;
}
