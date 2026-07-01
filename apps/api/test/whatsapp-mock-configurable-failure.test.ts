import { describe, expect, it } from 'vitest';
import { MockWhatsAppProvider } from '../src/lib/whatsapp/mock-provider.js';
import type { SendTemplateInput } from '../src/lib/whatsapp/provider.js';

const input: SendTemplateInput = {
  campaignName: 'appointment_reminder_24h',
  destination: '+919876543210',
  userName: 'Akhilesh',
  templateParams: ['Akhilesh', 'Smile Dental Care', '10:30 AM'],
};

describe('MockWhatsAppProvider — configurable failure', () => {
  it('failureRate 1.0 always fails with zero cost', async () => {
    const p = new MockWhatsAppProvider({ failureRate: 1 });
    const res = await p.sendTemplate(input);
    expect(res.status).toBe('failed');
    expect(res.costPaise).toBe(0);
  });

  it('failureRate 0 never fails', async () => {
    const p = new MockWhatsAppProvider({ failureRate: 0 });
    const res = await p.sendTemplate(input);
    expect(res.status).toBe('sent');
    expect(res.costPaise).toBe(35);
  });

  it('clamps out-of-range failure rates', async () => {
    const high = new MockWhatsAppProvider({ failureRate: 5 });
    const low = new MockWhatsAppProvider({ failureRate: -1 });
    expect((await high.sendTemplate(input)).status).toBe('failed');
    expect((await low.sendTemplate(input)).status).toBe('sent');
  });
});
