import { describe, expect, it } from 'vitest';
import { AiSensyProvider } from '../src/lib/whatsapp/aisensy-provider.js';

const provider = new AiSensyProvider({ apiKey: 'sk_x', webhookSecret: 'secret' });

describe('AiSensy inbound webhook parsing', () => {
  it('parses a plain text message', () => {
    const events = provider.parseInboundWebhook({
      messages: [{ from: '+919876543210', type: 'text', id: 'wamid.1', text: { body: 'Hello there' } }],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromPhone: '+919876543210', type: 'text', text: 'Hello there', providerMessageId: 'wamid.1' });
  });

  it('parses a button reply with its payload id (1 = confirm)', () => {
    const events = provider.parseInboundWebhook({
      messages: [
        {
          from: '+919876543210',
          type: 'interactive',
          id: 'wamid.2',
          interactive: { button_reply: { id: '1', title: 'Confirm' } },
        },
      ],
    });
    expect(events[0]).toMatchObject({ type: 'button_reply', buttonId: '1', text: 'Confirm' });
  });

  it('parses status webhooks and ignores unknown statuses', () => {
    const events = provider.parseStatusWebhook({
      statuses: [
        { id: 'wamid.1', status: 'delivered', timestamp: '1700000000' },
        { id: 'wamid.2', status: 'bogus' },
        { id: 'wamid.3', status: 'failed', errors: [{ message: 'undeliverable' }] },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ providerMessageId: 'wamid.1', status: 'delivered' });
    expect(events[1]).toMatchObject({ providerMessageId: 'wamid.3', status: 'failed', failureReason: 'undeliverable' });
  });

  it('returns an empty array for a payload with no messages', () => {
    expect(provider.parseInboundWebhook({})).toEqual([]);
    expect(provider.parseStatusWebhook({})).toEqual([]);
  });
});
