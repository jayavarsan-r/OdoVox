import type { InboundEvent } from '../whatsapp/provider.js';

/**
 * Phase 9.7 §2.6 — every lab communication goes through this interface so the transport can swap
 * (AiSensy → Meta direct → a future DentNodeLabAdapter) as a config change, not a rewrite.
 * "WhatsApp is the transport, the database is the truth."
 */

export type LabTemplateKey = 'lab_t1_new_case' | 'lab_t2_nudge' | 'lab_t3_dispatch' | 'lab_t4_receipt' | 'lab_t5_patient_fitting' | 'lab_t_consent';

export interface LabSendTemplateInput {
  /** Destination phone in E.164. */
  destination: string;
  vendorName: string;
  templateKey: LabTemplateKey;
  language: string; // 'en' | 'ta' | 'hi'
  /** Fully-rendered body (the adapter may re-render for template-strict BSPs). */
  body: string;
  buttons: LabButtonPayload[];
}

export interface LabSendMessageInput {
  /** Free-text reply inside the 24h service window. */
  destination: string;
  vendorName: string;
  text: string;
}

export interface LabSendResult {
  providerMessageId: string;
  status: string;
  costPaise: number;
}

/** Structured quick-reply payload — JSON, never free text (§2.7). */
export interface LabButtonPayload {
  action: 'status' | 'consent';
  caseId?: string;
  to?: string; // target LabCaseStatus for action=status
  value?: string; // 'yes' | 'no' for action=consent
  label: string; // human button label
}

export type InboundLabEvent = InboundEvent;

export interface ILabTransportAdapter {
  readonly label: string;
  sendCaseTemplate(input: LabSendTemplateInput): Promise<LabSendResult>;
  sendMessage(input: LabSendMessageInput): Promise<LabSendResult>;
  parseInboundWebhook(payload: unknown): InboundLabEvent[];
  /** Structured button payload from an inbound event, or null when it's not a button reply. */
  parseStatusButton(event: InboundLabEvent): LabButtonPayload | null;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
