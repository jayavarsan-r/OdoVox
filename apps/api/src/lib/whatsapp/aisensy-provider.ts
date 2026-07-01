import { AppError } from '../errors.js';
import { verifyWebhookSignature } from '../payments/signature.js';
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
import { parseAiSensyInbound, parseAiSensyStatus } from './mock-provider.js';

/** Minimal logger shape so the provider can take a Fastify/Pino logger without a hard dep. */
export interface WhatsAppLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface AiSensyOptions {
  apiKey: string;
  webhookSecret: string;
  baseUrl?: string;
}

/**
 * AiSensy's template-send request body. Pure + exported so its shape is unit-tested without network.
 * (Verify against current AiSensy docs at integration time — the v2 endpoint shape may drift.)
 */
export function buildAiSensyPayload(apiKey: string, input: SendTemplateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    apiKey,
    campaignName: input.campaignName,
    destination: input.destination,
    userName: input.userName,
    templateParams: input.templateParams,
  };
  if (input.media) {
    body.media = { url: input.media.url, filename: input.media.filename };
  }
  return body;
}

/**
 * Real AiSensy WhatsApp Business API gateway. Template sends go through AiSensy campaigns; delivery
 * status + inbound replies arrive via signed webhooks. Provider selection is a key swap via env —
 * the send pipeline + webhook routes only ever see `IWhatsAppProvider`, so this stays swappable.
 */
export class AiSensyProvider implements IWhatsAppProvider {
  readonly label = 'aisensy';
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(opts: AiSensyOptions, private readonly logger?: WhatsAppLogger) {
    if (!opts.apiKey || !opts.webhookSecret) {
      throw new AppError('AiSensy config missing', 500, 'AISENSY_CONFIG');
    }
    this.apiKey = opts.apiKey;
    this.webhookSecret = opts.webhookSecret;
    this.baseUrl = opts.baseUrl ?? 'https://backend.aisensy.com';
  }

  private async call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const detail = (json.errorMessage as string | undefined) ?? (json.message as string | undefined) ?? res.statusText;
      this.logger?.error({ path, status: res.status, detail }, 'aisensy call failed');
      throw new AppError(`AiSensy error: ${detail}`, 502, 'AISENSY_UPSTREAM');
    }
    return json as T;
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
    const json = await this.call<{ status?: string; messageId?: string; costPaise?: number }>(
      '/campaign/t1/api/v2',
      buildAiSensyPayload(this.apiKey, input),
    );
    return {
      providerMessageId: json.messageId ?? '',
      status: json.status ?? 'sent',
      costPaise: json.costPaise ?? DEFAULT_COST_PAISE,
      raw: json,
    };
  }

  async sendSession(input: SendSessionInput): Promise<SendResult> {
    const json = await this.call<{ status?: string; messageId?: string; costPaise?: number }>(
      '/campaign/t1/api/v2',
      { apiKey: this.apiKey, destination: input.destination, userName: input.userName, message: input.text },
    );
    return {
      providerMessageId: json.messageId ?? '',
      status: json.status ?? 'sent',
      costPaise: json.costPaise ?? DEFAULT_COST_PAISE,
      raw: json,
    };
  }

  async uploadMedia(_file: Buffer, _mimeType: string): Promise<{ mediaId: string }> {
    // AiSensy accepts a public/signed URL directly on the send; explicit upload is a no-op here.
    throw new AppError('AiSensy sends media by URL — upload not required', 501, 'AISENSY_NO_UPLOAD');
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature, this.webhookSecret);
  }

  parseInboundWebhook(payload: unknown): InboundEvent[] {
    return parseAiSensyInbound(payload);
  }

  parseStatusWebhook(payload: unknown): StatusEvent[] {
    return parseAiSensyStatus(payload);
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    return { phoneNumber: '', status: 'connected' };
  }
}
