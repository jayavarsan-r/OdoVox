import { describe, expect, it } from 'vitest';
import {
  ConsentOptInInput,
  ConsentStatus,
  SendMessageInput,
  ConversationListFilter,
  WhatsAppBudgetInput,
} from './whatsapp.js';

describe('whatsapp types', () => {
  it('accepts a valid opt-in method and rejects patient_initiated (not manually selectable)', () => {
    expect(ConsentOptInInput.parse({ method: 'verbal' }).method).toBe('verbal');
    expect(ConsentOptInInput.safeParse({ method: 'patient_initiated' }).success).toBe(false);
  });

  it('enumerates all consent states', () => {
    expect(ConsentStatus.options).toContain('OPTED_IN');
    expect(ConsentStatus.options).toContain('EXPIRED');
  });

  it('requires a template key and variables map on manual send', () => {
    const ok = SendMessageInput.safeParse({
      patientId: 'p1',
      templateKey: 'appointment_reminder_24h',
      variables: { 1: 'Meera', 2: 'Smile Dental', 3: '10:30 AM' },
    });
    expect(ok.success).toBe(true);
    expect(SendMessageInput.safeParse({ patientId: 'p1', templateKey: '' }).success).toBe(false);
  });

  it('defaults the inbox filter to ALL', () => {
    expect(ConversationListFilter.parse({}).status).toBe('ALL');
  });

  it('allows a null budget (unlimited) and bounds the warning threshold', () => {
    expect(WhatsAppBudgetInput.parse({ budgetPaise: null }).budgetPaise).toBeNull();
    expect(WhatsAppBudgetInput.safeParse({ budgetPaise: 50000, warningThreshold: 1.5 }).success).toBe(false);
  });
});
