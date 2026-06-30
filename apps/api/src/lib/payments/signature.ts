import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay signs webhook bodies with HMAC-SHA256(secret, rawBody), hex-encoded, sent in the
 * `X-Razorpay-Signature` header. We verify with a constant-time compare so a mismatched-length or
 * wrong signature can't be distinguished by timing. Pure + shared by the mock and real gateways
 * (so the mock's webhook simulator produces signatures the same verifier accepts).
 */
export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = computeWebhookSignature(payload, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
