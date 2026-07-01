import { describe, expect, it } from 'vitest';
import {
  allSlotsFilled,
  budgetPercent,
  categoryMeta,
  conversationStatusLabel,
  messageStatusLabel,
  messageStatusTone,
  renderTemplatePreview,
  rupees,
  templateSlots,
  windowCountdown,
  windowOpen,
} from './whatsapp-ui';

describe('categoryMeta', () => {
  it('maps each category to a label + dot colour, defaulting when null', () => {
    expect(categoryMeta('RESCHEDULE_REQUEST').label).toBe('Reschedule');
    expect(categoryMeta('COMPLAINT').dot).toBe('bg-danger');
    expect(categoryMeta(null).label).toBe('General');
  });
});

describe('conversationStatusLabel', () => {
  it('humanises the status', () => {
    expect(conversationStatusLabel('IN_PROGRESS')).toBe('In progress');
    expect(conversationStatusLabel('RESOLVED')).toBe('Resolved');
  });
});

describe('messageStatus', () => {
  it('labels delivery states with ticks', () => {
    expect(messageStatusLabel('DELIVERED')).toBe('Delivered ✓✓');
    expect(messageStatusLabel('READ')).toBe('Read ✓✓');
    expect(messageStatusLabel('BLOCKED_NO_CONSENT')).toContain('no consent');
  });
  it('tones read as read, failures as failed', () => {
    expect(messageStatusTone('READ')).toBe('read');
    expect(messageStatusTone('FAILED')).toBe('failed');
    expect(messageStatusTone('BLOCKED_BUDGET')).toBe('failed');
    expect(messageStatusTone('SENT')).toBe('muted');
  });
});

describe('24-hour window', () => {
  const now = new Date('2026-07-01T12:00:00Z');
  it('is open before expiry and closed after', () => {
    expect(windowOpen('2026-07-01T13:00:00Z', now)).toBe(true);
    expect(windowOpen('2026-07-01T11:00:00Z', now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });
  it('formats a countdown, showing hours + minutes', () => {
    expect(windowCountdown('2026-07-02T11:12:00Z', now)).toBe('23h 12m');
    expect(windowCountdown('2026-07-01T12:45:00Z', now)).toBe('45m');
    expect(windowCountdown('2026-07-01T11:00:00Z', now)).toBe('Closed');
  });
});

describe('template preview + slots', () => {
  const body = 'Hi {{1}}, your appointment at {{2}} is at {{3}}.';
  it('lists the ordered slots', () => {
    expect(templateSlots(body)).toEqual(['1', '2', '3']);
  });
  it('substitutes filled variables and leaves blanks as placeholders', () => {
    expect(renderTemplatePreview(body, { 1: 'Meera', 2: 'Smile Dental', 3: '' })).toBe(
      'Hi Meera, your appointment at Smile Dental is at {{3}}.',
    );
  });
  it('gates send until every slot is filled', () => {
    expect(allSlotsFilled(body, { 1: 'Meera', 2: 'Smile', 3: '10:30' })).toBe(true);
    expect(allSlotsFilled(body, { 1: 'Meera', 2: 'Smile', 3: ' ' })).toBe(false);
  });
});

describe('budget', () => {
  it('computes a capped percentage, null when unlimited', () => {
    expect(budgetPercent(28700, 50000)).toBe(57);
    expect(budgetPercent(60000, 50000)).toBe(100);
    expect(budgetPercent(100, null)).toBeNull();
  });
  it('formats rupees from paise', () => {
    expect(rupees(50000)).toBe('₹500');
    expect(rupees(28750)).toBe('₹287.5');
  });
});
