import { describe, expect, it } from 'vitest';
import { MockWhatsAppProvider } from '../src/lib/whatsapp/mock-provider.js';
import type { SendTemplateInput } from '../src/lib/whatsapp/provider.js';

const input: SendTemplateInput = {
  campaignName: 'appointment_reminder_24h',
  destination: '+919876543210',
  userName: 'Akhilesh',
  templateParams: ['Akhilesh', 'Smile Dental Care', '10:30 AM'],
};

describe('MockWhatsAppProvider — success', () => {
  it('is deterministic — same input yields the same message id', async () => {
    const p = new MockWhatsAppProvider();
    const a = await p.sendTemplate(input);
    const b = await p.sendTemplate(input);
    expect(a).toEqual(b);
    expect(a.providerMessageId).toMatch(/^mock-/);
    expect(a.status).toBe('sent');
    expect(a.costPaise).toBe(35);
  });

  it('returns a business profile marked connected', async () => {
    const p = new MockWhatsAppProvider();
    const profile = await p.getBusinessProfile();
    expect(profile.status).toBe('connected');
    expect(profile.phoneNumber).toMatch(/^\+91/);
  });
});
