/**
 * Provider-agnostic OTP delivery. The rest of the app depends only on `IOtpSender`,
 * so swapping the mock sender for MSG91 (or, in Phase 9, WhatsApp / voice) is a one-line
 * change behind `getOtpSender()` driven by the `OTP_PROVIDER` env var.
 */

export interface OtpSendResult {
  /** mock-<id> or, for MSG91, the upstream request_id. */
  providerId: string;
  sentAt: Date;
}

export interface IOtpSender {
  send(phone: string, otp: string): Promise<OtpSendResult>;
  // Phase 9 will add: sendWhatsApp(phone, otp), sendVoice(phone, otp)
}

/** Minimal logger shape so senders can accept a Fastify/Pino logger without a hard dep. */
export interface OtpLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}
