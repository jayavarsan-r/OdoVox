import { describe, expect, it } from 'vitest';
import { AiSensyProvider } from '../src/lib/whatsapp/aisensy-provider.js';
import { computeWebhookSignature } from '../src/lib/payments/signature.js';

const SECRET = 'aisensy_webhook_secret_123';

describe('AiSensy webhook signature — invalid rejected', () => {
  const provider = new AiSensyProvider({ apiKey: 'sk_x', webhookSecret: SECRET });
  const payload = JSON.stringify({ statuses: [{ id: 'wamid.1', status: 'delivered' }] });

  it('rejects a wrong signature', () => {
    expect(provider.verifyWebhookSignature(payload, 'deadbeef')).toBe(false);
  });

  it('rejects a signature computed with a different secret', () => {
    const forged = computeWebhookSignature(payload, 'wrong_secret');
    expect(provider.verifyWebhookSignature(payload, forged)).toBe(false);
  });

  it('rejects a tampered payload with an otherwise-valid signature', () => {
    const signature = computeWebhookSignature(payload, SECRET);
    const tampered = payload.replace('delivered', 'read');
    expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(provider.verifyWebhookSignature(payload, '')).toBe(false);
  });
});
