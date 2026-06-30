import { AppError } from '../errors.js';
import type {
  CaptureResult,
  IPaymentGateway,
  PaymentLinkInput,
  PaymentLinkResult,
  RefundResult,
} from './gateway.js';
import { verifyWebhookSignature } from './signature.js';

const RAZORPAY_BASE = 'https://api.razorpay.com/v1';

/** Minimal logger shape so the gateway can take a Fastify/Pino logger without a hard dep. */
export interface PaymentLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** Razorpay's payment-link request body. Pure + exported so its shape is unit-tested without network. */
export function buildPaymentLinkPayload(input: PaymentLinkInput): Record<string, unknown> {
  // Razorpay only notifies via sms/email; WhatsApp we send ourselves (wa.me deep link).
  const sms = input.notify === 'sms' || input.notify === 'both';
  const payload: Record<string, unknown> = {
    amount: input.amountPaise,
    currency: 'INR',
    accept_partial: false,
    description: input.description,
    reference_id: input.referenceId,
    customer: {
      name: input.customer.name,
      contact: input.customer.contact,
      ...(input.customer.email ? { email: input.customer.email } : {}),
    },
    notify: { sms, email: false },
    reminder_enable: sms,
    notes: input.notes ?? {},
  };
  if (input.expiresInHours && input.expiresInHours > 0) {
    // Razorpay wants an absolute epoch (seconds); minimum 15 min in the future.
    payload.expire_by = Math.floor(Date.now() / 1000) + Math.round(input.expiresInHours * 3600);
  }
  return payload;
}

/** Razorpay's refund request body. Pure + exported for unit testing. */
export function buildRefundPayload(amountPaise: number, notes?: Record<string, string>): Record<string, unknown> {
  return { amount: amountPaise, speed: 'normal', ...(notes ? { notes } : {}) };
}

/**
 * Real Razorpay gateway. Payment Links flow (not the checkout SDK) so a receptionist can send a link
 * over WhatsApp and the patient pays on Razorpay's hosted page (Capacitor-friendly). Test/live is a
 * key swap via env. The billing routes only ever see `IPaymentGateway`, so this stays swappable.
 */
export class RazorpayGateway implements IPaymentGateway {
  readonly label: string;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    opts: { keyId: string; keySecret: string; webhookSecret: string; mode?: 'test' | 'live' },
    private readonly logger?: PaymentLogger,
  ) {
    if (!opts.keyId || !opts.keySecret) {
      throw new AppError('Razorpay keys missing', 500, 'RAZORPAY_CONFIG');
    }
    this.keyId = opts.keyId;
    this.keySecret = opts.keySecret;
    this.webhookSecret = opts.webhookSecret;
    this.label = `razorpay · ${opts.mode ?? 'test'}`;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  private async call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${RAZORPAY_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail = (json.error as { description?: string } | undefined)?.description ?? res.statusText;
      this.logger?.error({ path, status: res.status, detail }, 'razorpay call failed');
      throw new AppError(`Razorpay error: ${detail}`, 502, 'RAZORPAY_UPSTREAM');
    }
    return json as T;
  }

  async createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
    const json = await this.call<{ id: string; short_url: string; order_id?: string; status: string }>(
      '/payment_links',
      buildPaymentLinkPayload(input),
    );
    return {
      linkId: json.id,
      orderId: json.order_id ?? null,
      shortUrl: json.short_url,
      status: json.status,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature, this.webhookSecret);
  }

  async capturePayment(paymentId: string, amountPaise: number): Promise<CaptureResult> {
    const json = await this.call<{ id: string; status: string; fee?: number }>(
      `/payments/${paymentId}/capture`,
      { amount: amountPaise, currency: 'INR' },
    );
    return { paymentId: json.id, status: json.status, feePaise: json.fee ?? 0 };
  }

  async refund(paymentId: string, amountPaise: number, notes?: Record<string, string>): Promise<RefundResult> {
    const json = await this.call<{ id: string; status: string }>(
      `/payments/${paymentId}/refund`,
      buildRefundPayload(amountPaise, notes),
    );
    return { refundId: json.id, status: json.status };
  }
}
