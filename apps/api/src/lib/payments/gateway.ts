/**
 * Provider-agnostic payment gateway. The billing routes depend only on `IPaymentGateway`, so
 * swapping the deterministic mock for the real Razorpay API is a one-line change behind
 * `getPaymentGateway()` driven by `PAYMENT_PROVIDER`. Mirrors the STT/AI provider abstractions.
 *
 * All money is paise (Int) — same convention as the rest of Odovox. `amountPaise` is what Razorpay
 * calls `amount` (it also works in the smallest currency unit). See docs/billing.md.
 */

export interface PaymentLinkCustomer {
  name: string;
  /** E.164-ish phone, e.g. +919876543210. */
  contact: string;
  email?: string;
}

export type PaymentLinkNotify = 'sms' | 'whatsapp' | 'both' | 'none';

export interface PaymentLinkInput {
  amountPaise: number;
  /** Our reference echoed back on the webhook (we pass the Payment id / number). */
  referenceId: string;
  description: string;
  customer: PaymentLinkCustomer;
  notify: PaymentLinkNotify;
  expiresInHours?: number;
  /** Opaque key/value echoed back by Razorpay on webhook (we stash billId + clinicId). */
  notes?: Record<string, string>;
}

export interface PaymentLinkResult {
  /** Razorpay payment-link id (plink_…) or the mock equivalent. */
  linkId: string;
  /** Razorpay order id, when the provider creates one. */
  orderId: string | null;
  shortUrl: string;
  status: string;
}

export interface CaptureResult {
  paymentId: string;
  status: string;
  feePaise: number;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface IPaymentGateway {
  /** Human/provider label for logs + receipts, e.g. 'mock' or 'razorpay · test'. */
  readonly label: string;
  createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult>;
  /** HMAC-SHA256 verify of a raw webhook body against the configured webhook secret. */
  verifyWebhookSignature(payload: string, signature: string): boolean;
  capturePayment(paymentId: string, amountPaise: number): Promise<CaptureResult>;
  refund(paymentId: string, amountPaise: number, notes?: Record<string, string>): Promise<RefundResult>;
}
