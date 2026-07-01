import { describe, expect, it } from 'vitest';
import { buildAiSensyPayload } from '../src/lib/whatsapp/aisensy-provider.js';
import type { SendTemplateInput } from '../src/lib/whatsapp/provider.js';

describe('AiSensy request shape', () => {
  it('builds the campaign payload with ordered template params', () => {
    const input: SendTemplateInput = {
      campaignName: 'appointment_reminder_24h',
      destination: '+919876543210',
      userName: 'Akhilesh',
      templateParams: ['Akhilesh', 'Smile Dental Care', '10:30 AM'],
    };
    const body = buildAiSensyPayload('sk_aisensy_test', input);
    expect(body).toMatchObject({
      apiKey: 'sk_aisensy_test',
      campaignName: 'appointment_reminder_24h',
      destination: '+919876543210',
      userName: 'Akhilesh',
      templateParams: ['Akhilesh', 'Smile Dental Care', '10:30 AM'],
    });
    expect(body.media).toBeUndefined();
  });

  it('includes media { url, filename } when an attachment is present', () => {
    const input: SendTemplateInput = {
      campaignName: 'payment_receipt',
      destination: '+919876543210',
      userName: 'Akhilesh',
      templateParams: ['Akhilesh', '3,500', 'RC-001'],
      media: { url: 'https://signed/receipt.pdf', filename: 'receipt.pdf' },
    };
    const body = buildAiSensyPayload('sk_aisensy_test', input);
    expect(body.media).toEqual({ url: 'https://signed/receipt.pdf', filename: 'receipt.pdf' });
  });
});
