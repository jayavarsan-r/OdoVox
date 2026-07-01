import { describe, expect, it } from 'vitest';
import { AiSensyProvider } from '../src/lib/whatsapp/aisensy-provider.js';
import { computeWebhookSignature } from '../src/lib/payments/signature.js';

const SECRET = 'aisensy_webhook_secret_123';

describe('AiSensy webhook signature — valid', () => {
  it('accepts a correctly HMAC-SHA256-signed payload', () => {
    const provider = new AiSensyProvider({ apiKey: 'sk_x', webhookSecret: SECRET });
    const payload = JSON.stringify({ statuses: [{ id: 'wamid.1', status: 'delivered' }] });
    const signature = computeWebhookSignature(payload, SECRET);
    expect(provider.verifyWebhookSignature(payload, signature)).toBe(true);
  });
});
