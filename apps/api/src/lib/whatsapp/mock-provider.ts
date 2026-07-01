import { createHash } from 'node:crypto';
import { computeWebhookSignature, verifyWebhookSignature } from '../payments/signature.js';
import {
  DEFAULT_COST_PAISE,
  type BusinessProfile,
  type IWhatsAppProvider,
  type InboundEvent,
  type SendResult,
  type SendSessionInput,
  type SendTemplateInput,
  type StatusEvent,
} from './provider.js';

export const MOCK_WHATSAPP_WEBHOOK_SECRET = 'mock_whatsapp_webhook_secret';

/** Deterministic 0..1 fraction from a string — reproducible chaos knob for tests. */
function hashFraction(input: string): number {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

/** Short deterministic id suffix so the same destination+campaign always yields the same message id. */
function idFor(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

export interface MockWhatsAppOptions {
  /** Fraction (0..1) of sends that simulate a FAILED delivery. Default 0 (always succeed). */
  failureRate?: number;
  webhookSecret?: string;
}

/**
 * Deterministic in-memory WhatsApp provider. No network, no AiSensy account. Same input always
 * produces the same message id, so tests can assert exact values. `failureRate` makes `sendTemplate`
 * return a failed result for a reproducible subset of messages (chaos testing). Webhook parsing
 * understands the AiSensy shape so smoke tests can POST forged (but validly-signed) events.
 */
export class MockWhatsAppProvider implements IWhatsAppProvider {
  readonly label = 'mock';
  private readonly failureRate: number;
  private readonly webhookSecret: string;

  constructor(opts: MockWhatsAppOptions = {}) {
    this.failureRate = Math.min(1, Math.max(0, opts.failureRate ?? 0));
    this.webhookSecret = opts.webhookSecret ?? MOCK_WHATSAPP_WEBHOOK_SECRET;
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const key = `${input.campaignName}:${input.destination}:${input.templateParams.join('|')}`;
    const failed = hashFraction(key) < this.failureRate;
    return {
      providerMessageId: `mock-${idFor(key)}`,
      status: failed ? 'failed' : 'sent',
      costPaise: failed ? 0 : DEFAULT_COST_PAISE,
      raw: { mock: true },
    };
  }

  async sendSession(input: SendSessionInput): Promise<SendResult> {
    const key = `session:${input.destination}:${input.text}`;
    return {
      providerMessageId: `mock-${idFor(key)}`,
      status: 'sent',
      costPaise: DEFAULT_COST_PAISE,
      raw: { mock: true },
    };
  }

  async uploadMedia(file: Buffer, mimeType: string): Promise<{ mediaId: string }> {
    return { mediaId: `mock-media-${idFor(`${file.length}:${mimeType}`)}` };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature, this.webhookSecret);
  }

  /** Sign a payload with the mock secret — used by the webhook simulator to forge valid events. */
  signWebhook(payload: string): string {
    return computeWebhookSignature(payload, this.webhookSecret);
  }

  parseInboundWebhook(payload: unknown): InboundEvent[] {
    return parseAiSensyInbound(payload);
  }

  parseStatusWebhook(payload: unknown): StatusEvent[] {
    return parseAiSensyStatus(payload);
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    return { phoneNumber: '+918000000000', status: 'connected' };
  }
}

// ---------------------------------------------------------------------------
// Shared AiSensy-shaped webhook parsers (mock + real provider parse identically, so a forged
// mock event exercises the same code path as a real one).
// ---------------------------------------------------------------------------

interface AiSensyInboundPayload {
  /** Business number the messages were sent to (Meta: metadata.display_phone_number). */
  to?: string;
  metadata?: { display_phone_number?: string };
  messages?: Array<{
    from?: string;
    to?: string;
    type?: string;
    id?: string;
    timestamp?: string | number;
    text?: { body?: string };
    button?: { payload?: string; text?: string };
    interactive?: {
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string };
    };
  }>;
}

export function parseAiSensyInbound(payload: unknown): InboundEvent[] {
  const p = (payload ?? {}) as AiSensyInboundPayload;
  const messages = Array.isArray(p.messages) ? p.messages : [];
  const businessNumber = p.to ?? p.metadata?.display_phone_number;
  const events: InboundEvent[] = [];
  for (const m of messages) {
    if (!m.from) continue;
    const toPhone = m.to ?? businessNumber;
    const ts = m.timestamp != null ? new Date(Number(m.timestamp) * (String(m.timestamp).length <= 10 ? 1000 : 1)) : undefined;
    if (m.interactive?.button_reply || m.button) {
      const id = m.interactive?.button_reply?.id ?? m.button?.payload ?? m.button?.text;
      const text = m.interactive?.button_reply?.title ?? m.button?.text;
      events.push({ fromPhone: m.from, toPhone, type: 'button_reply', buttonId: id, text, providerMessageId: m.id, timestamp: ts });
    } else if (m.interactive?.list_reply) {
      events.push({
        fromPhone: m.from,
        toPhone,
        type: 'list_reply',
        buttonId: m.interactive.list_reply.id,
        text: m.interactive.list_reply.title,
        providerMessageId: m.id,
        timestamp: ts,
      });
    } else if (m.type === 'image' || m.type === 'document') {
      events.push({ fromPhone: m.from, toPhone, type: m.type, providerMessageId: m.id, timestamp: ts });
    } else {
      events.push({ fromPhone: m.from, toPhone, type: 'text', text: m.text?.body ?? '', providerMessageId: m.id, timestamp: ts });
    }
  }
  return events;
}

interface AiSensyStatusPayload {
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string | number;
    errors?: Array<{ title?: string; message?: string }>;
  }>;
}

export function parseAiSensyStatus(payload: unknown): StatusEvent[] {
  const p = (payload ?? {}) as AiSensyStatusPayload;
  const statuses = Array.isArray(p.statuses) ? p.statuses : [];
  const events: StatusEvent[] = [];
  for (const s of statuses) {
    if (!s.id || !s.status) continue;
    const status = s.status as StatusEvent['status'];
    if (!['sent', 'delivered', 'read', 'failed'].includes(status)) continue;
    const ts = s.timestamp != null ? new Date(Number(s.timestamp) * (String(s.timestamp).length <= 10 ? 1000 : 1)) : undefined;
    events.push({
      providerMessageId: s.id,
      status,
      timestamp: ts,
      failureReason: s.errors?.[0]?.message ?? s.errors?.[0]?.title,
    });
  }
  return events;
}
