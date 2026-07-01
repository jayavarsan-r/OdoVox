/**
 * Provider-agnostic WhatsApp Business API. The send pipeline + webhook routes depend only on
 * `IWhatsAppProvider`, so swapping the deterministic mock for real AiSensy is a one-line change
 * behind `getWhatsAppProvider()` driven by `WHATSAPP_PROVIDER`. Mirrors the STT/AI/Payments
 * abstractions. Patient-facing only — lab vendors stay on `wa.me` deep links (Phase 7).
 *
 * All money is paise (Int) — same convention as the rest of Odovox (~35 paise per conversation in
 * India). See docs/whatsapp.md.
 */

export interface WhatsAppMedia {
  /** Signed URL AiSensy fetches the attachment from. */
  url: string;
  filename: string;
}

export interface SendTemplateInput {
  /** AiSensy campaign / Meta template name, e.g. 'appointment_reminder_24h'. */
  campaignName: string;
  /** Destination phone in E.164 (+91XXXXXXXXXX). */
  destination: string;
  userName: string;
  /** Ordered values for {{1}}, {{2}}, … */
  templateParams: string[];
  media?: WhatsAppMedia;
}

export interface SendSessionInput {
  /** Free-text reply, only valid inside the 24-hour customer-service window. */
  destination: string;
  userName: string;
  text: string;
}

export interface SendResult {
  /** AiSensy message id (or the mock equivalent). */
  providerMessageId: string;
  /** 'queued' | 'sent' | 'delivered' | 'read' | 'failed' */
  status: string;
  costPaise: number;
  raw?: unknown;
}

export type InboundKind = 'text' | 'button_reply' | 'list_reply' | 'image' | 'document';

export interface InboundEvent {
  /** Raw sender phone in E.164. */
  fromPhone: string;
  /** The clinic's WhatsApp business number the message was sent to (resolves which clinic owns it). */
  toPhone?: string;
  type: InboundKind;
  text?: string;
  /** Quick-reply / list-reply payload id (e.g. '1' = confirm, '2' = reschedule). */
  buttonId?: string;
  providerMessageId?: string;
  timestamp?: Date;
}

export interface StatusEvent {
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: Date;
  failureReason?: string;
}

export interface BusinessProfile {
  phoneNumber: string;
  status: string;
}

export interface IWhatsAppProvider {
  /** Human/provider label for logs, e.g. 'mock' or 'aisensy'. */
  readonly label: string;
  sendTemplate(input: SendTemplateInput): Promise<SendResult>;
  /** Free-text session message, within the 24-hour window. */
  sendSession(input: SendSessionInput): Promise<SendResult>;
  uploadMedia(file: Buffer, mimeType: string): Promise<{ mediaId: string }>;
  /** HMAC-SHA256 verify of a raw webhook body against the configured webhook secret. */
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseInboundWebhook(payload: unknown): InboundEvent[];
  parseStatusWebhook(payload: unknown): StatusEvent[];
  getBusinessProfile(): Promise<BusinessProfile>;
}

/** Default cost per conversation in India (~₹0.35). Mock returns this; AiSensy overrides from response. */
export const DEFAULT_COST_PAISE = 35;
