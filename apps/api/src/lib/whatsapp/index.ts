import { loadEnv } from '../env.js';
import { AiSensyProvider, type WhatsAppLogger } from './aisensy-provider.js';
import { MockWhatsAppProvider } from './mock-provider.js';
import type { IWhatsAppProvider } from './provider.js';

export type {
  IWhatsAppProvider,
  SendTemplateInput,
  SendSessionInput,
  SendResult,
  InboundEvent,
  InboundKind,
  StatusEvent,
  BusinessProfile,
  WhatsAppMedia,
} from './provider.js';
export { DEFAULT_COST_PAISE } from './provider.js';
export {
  MockWhatsAppProvider,
  MOCK_WHATSAPP_WEBHOOK_SECRET,
  parseAiSensyInbound,
  parseAiSensyStatus,
} from './mock-provider.js';
export { AiSensyProvider, buildAiSensyPayload, type WhatsAppLogger } from './aisensy-provider.js';
export { checkConsent, CONSENT_TTL_MONTHS, type ConsentCheck, type ConsentBlockReason } from './consent.js';
export {
  sendWhatsAppMessage,
  runWhatsAppSendJob,
  monthSpendPaise,
  type SendDeps,
  type SendWorkerDeps,
  type SendWhatsAppInput,
  type SendOutcome,
  type SendBlockReason,
} from './send.js';
export {
  renderTemplateBody,
  normalizeIndianPhone,
  serializeMessage,
  startOfMonth,
  type MessageAttachmentShape,
} from './render.js';
export {
  categorize,
  windowOpen,
  upsertConversationOnInbound,
  touchConversationOnOutbound,
  serializeConversationListItem,
} from './conversation.js';
export {
  processInboundWebhook,
  processStatusWebhook,
  type WebhookOutcome as WhatsAppWebhookOutcome,
} from './webhook-service.js';
export { notifyLabCaseReady, notifyPaymentReceipt } from './cross-wire.js';
export { whatsappSendDeps } from './deps.js';

let cached: IWhatsAppProvider | null = null;

/**
 * Returns the WhatsApp provider selected by WHATSAPP_PROVIDER. Defaults to the deterministic mock so
 * dev and tests never hit (or pay for) the real AiSensy API. The mock's chaos knob comes from
 * MOCK_WHATSAPP_FAILURE_RATE. Memoised per process (cleared via resetWhatsAppProvider in tests).
 */
export function getWhatsAppProvider(logger?: WhatsAppLogger): IWhatsAppProvider {
  if (cached) return cached;
  const env = loadEnv();
  if (env.WHATSAPP_PROVIDER === 'aisensy') {
    cached = new AiSensyProvider(
      {
        apiKey: env.AISENSY_API_KEY!,
        webhookSecret: env.AISENSY_WEBHOOK_SECRET!,
        baseUrl: env.AISENSY_BASE_URL,
      },
      logger,
    );
  } else {
    cached = new MockWhatsAppProvider({ failureRate: env.MOCK_WHATSAPP_FAILURE_RATE });
  }
  return cached;
}

/** Test seam — drop the memoised provider so a test can re-read env. */
export function resetWhatsAppProvider(): void {
  cached = null;
}
