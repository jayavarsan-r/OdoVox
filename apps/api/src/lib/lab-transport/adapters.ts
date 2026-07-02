import { createHash } from 'node:crypto';
import { getWhatsAppProvider } from '../whatsapp/index.js';
import type { IWhatsAppProvider } from '../whatsapp/provider.js';
import type { ILabTransportAdapter, InboundLabEvent, LabButtonPayload, LabSendMessageInput, LabSendResult, LabSendTemplateInput } from './types.js';

/**
 * Phase 9.7 §2.6 adapters. `WhatsAppLabAdapter` rides the Phase 9 provider (AiSensy or its mock,
 * per WHATSAPP_PROVIDER) — one webhook secret, one cost ledger. `MockLabAdapter` is fully
 * deterministic with zero provider involvement, for tests that assert exact ids. A future
 * `DentNodeLabAdapter` implements the same interface against the DentNode API.
 */

/** Buttons ride the BSP as JSON payload ids; inbound button replies parse back here. */
export function parseButtonPayload(raw: string | undefined): LabButtonPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LabButtonPayload>;
    if (parsed.action === 'status' && parsed.caseId && parsed.to) return parsed as LabButtonPayload;
    if (parsed.action === 'consent' && parsed.value) return parsed as LabButtonPayload;
    return null;
  } catch {
    return null;
  }
}

export class WhatsAppLabAdapter implements ILabTransportAdapter {
  readonly label: string;
  constructor(private readonly provider: IWhatsAppProvider = getWhatsAppProvider()) {
    this.label = `whatsapp:${provider.label}`;
  }

  async sendCaseTemplate(input: LabSendTemplateInput): Promise<LabSendResult> {
    const result = await this.provider.sendTemplate({
      campaignName: input.templateKey,
      destination: input.destination,
      userName: input.vendorName,
      // Body + serialized buttons ride as template params; AiSensy maps them onto the approved
      // Meta template's variables and quick-reply payloads.
      templateParams: [input.body, ...input.buttons.map((b) => JSON.stringify(b))],
    });
    return { providerMessageId: result.providerMessageId, status: result.status, costPaise: result.costPaise };
  }

  async sendMessage(input: LabSendMessageInput): Promise<LabSendResult> {
    const result = await this.provider.sendSession({ destination: input.destination, userName: input.vendorName, text: input.text });
    return { providerMessageId: result.providerMessageId, status: result.status, costPaise: result.costPaise };
  }

  parseInboundWebhook(payload: unknown): InboundLabEvent[] {
    return this.provider.parseInboundWebhook(payload);
  }

  parseStatusButton(event: InboundLabEvent): LabButtonPayload | null {
    if (event.type !== 'button_reply') return null;
    return parseButtonPayload(event.buttonId);
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.provider.verifyWebhookSignature(payload, signature);
  }
}

/** Deterministic, provider-free adapter: same input → same message id; never fails. */
export class MockLabAdapter implements ILabTransportAdapter {
  readonly label = 'mock-lab';
  readonly sent: LabSendTemplateInput[] = [];

  async sendCaseTemplate(input: LabSendTemplateInput): Promise<LabSendResult> {
    this.sent.push(input);
    const id = createHash('sha256').update(`${input.templateKey}:${input.destination}:${input.body}`).digest('hex').slice(0, 12);
    return { providerMessageId: `mock_lab_${id}`, status: 'sent', costPaise: 35 };
  }

  async sendMessage(input: LabSendMessageInput): Promise<LabSendResult> {
    const id = createHash('sha256').update(`session:${input.destination}:${input.text}`).digest('hex').slice(0, 12);
    return { providerMessageId: `mock_lab_${id}`, status: 'sent', costPaise: 0 };
  }

  parseInboundWebhook(): InboundLabEvent[] {
    return [];
  }

  parseStatusButton(event: InboundLabEvent): LabButtonPayload | null {
    if (event.type !== 'button_reply') return null;
    return parseButtonPayload(event.buttonId);
  }

  verifyWebhookSignature(): boolean {
    return true;
  }
}

let cached: ILabTransportAdapter | null = null;

/** The active adapter — WhatsApp-backed (provider per WHATSAPP_PROVIDER). Tests may inject. */
export function getLabTransport(): ILabTransportAdapter {
  if (!cached) cached = new WhatsAppLabAdapter();
  return cached;
}

export function setLabTransportForTests(adapter: ILabTransportAdapter | null): void {
  cached = adapter;
}
