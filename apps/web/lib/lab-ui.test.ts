import { describe, expect, it } from 'vitest';
import {
  expectedReturnInfo,
  labCaseActions,
  labCaseTypeLabel,
  labStatusStyle,
  maskPhone,
  validateNewCase,
} from './lab-ui';

describe('labStatusStyle', () => {
  it('maps each status to the documented colour', () => {
    expect(labStatusStyle('SENT').bar).toBe('bg-sky');
    expect(labStatusStyle('IN_PROGRESS').bar).toBe('bg-lavender');
    expect(labStatusStyle('READY').bar).toBe('bg-lime');
    expect(labStatusStyle('DELIVERED').bar).toBe('bg-sage');
    expect(labStatusStyle('RETURNED_FOR_REWORK').bar).toBe('bg-peach');
    expect(labStatusStyle('DRAFT').bar).toBe('bg-border-strong');
  });
  it('marks CANCELLED as struck-through', () => {
    expect(labStatusStyle('CANCELLED').strikethrough).toBe(true);
    expect(labStatusStyle('COMPLETED').strikethrough).toBeUndefined();
  });
});

describe('labCaseTypeLabel', () => {
  it('humanises the enum', () => {
    expect(labCaseTypeLabel('CROWN')).toBe('Crown');
    expect(labCaseTypeLabel('DENTURE_PARTIAL')).toBe('Partial denture');
    expect(labCaseTypeLabel('INLAY_ONLAY')).toBe('Inlay/Onlay');
  });
});

describe('expectedReturnInfo', () => {
  const now = new Date('2026-06-30T00:00:00Z');
  it('returns null when no date', () => {
    expect(expectedReturnInfo(null, now)).toBeNull();
  });
  it('is normal when comfortably ahead', () => {
    const info = expectedReturnInfo(new Date('2026-07-05T00:00:00Z'), now);
    expect(info).toEqual({ label: '5 days left', tone: 'normal' });
  });
  it('warns under 2 days', () => {
    expect(expectedReturnInfo(new Date('2026-07-01T00:00:00Z'), now)!.tone).toBe('warning');
    expect(expectedReturnInfo(new Date('2026-06-30T05:00:00Z'), now)!.tone).toBe('warning');
  });
  it('turns red (overdue) once past the date', () => {
    const info = expectedReturnInfo(new Date('2026-06-27T00:00:00Z'), now);
    expect(info!.tone).toBe('overdue');
    expect(info!.label).toContain('Overdue');
  });
});

describe('labCaseActions', () => {
  it('returns status-appropriate actions', () => {
    expect(labCaseActions('DRAFT')).toEqual(['edit', 'send', 'cancel']);
    expect(labCaseActions('READY')).toEqual(['deliver', 'rework', 'cancel']);
    expect(labCaseActions('DELIVERED')).toEqual(['complete', 'rework']);
    expect(labCaseActions('COMPLETED')).toEqual([]);
    expect(labCaseActions('CANCELLED')).toEqual([]);
  });
});

describe('validateNewCase', () => {
  it('requires patient, vendor, type and at least one tooth', () => {
    const v = validateNewCase({});
    expect(v.valid).toBe(false);
    expect(Object.keys(v.errors).sort()).toEqual(['patientId', 'teeth', 'type', 'vendorId']);
  });
  it('passes when all required fields present', () => {
    expect(validateNewCase({ patientId: 'p', vendorId: 'v', type: 'CROWN', teeth: [26] }).valid).toBe(true);
  });
});

describe('maskPhone', () => {
  it('dots out the middle digits', () => {
    expect(maskPhone('9840012345')).toBe('98••••••45');
  });
});
