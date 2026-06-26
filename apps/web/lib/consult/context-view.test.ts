import { describe, expect, it } from 'vitest';
import type { ConsultationContext } from '@odovox/types';
import { complaintText, genderLabel, hasComplaint, NO_COMPLAINT, recordingStripText, xrayCount } from './context-view';

const ctx = (over: Partial<ConsultationContext['visit']> = {}, xrays: ConsultationContext['xrays'] = []): ConsultationContext => ({
  patient: { id: 'p1', name: 'Akhilesh Guhan', age: 21, gender: 'MALE', patientCode: 'PT-AUD9E', allergies: ['Penicillin'], medicalFlags: ['Diabetes'] },
  visit: { id: 'v1', tokenNumber: 3, chiefComplaint: 'Tooth pain on upper left, sensitive to cold', calledInAt: null, status: 'IN_CHAIR', ...over },
  xrays,
});

describe('consult context view', () => {
  it('shows the visit chief complaint', () => {
    expect(complaintText(ctx())).toBe('Tooth pain on upper left, sensitive to cold');
    expect(hasComplaint(ctx())).toBe(true);
  });

  it('falls back when there is no complaint', () => {
    expect(complaintText(ctx({ chiefComplaint: null }))).toBe(NO_COMPLAINT);
    expect(complaintText(ctx({ chiefComplaint: '   ' }))).toBe(NO_COMPLAINT);
    expect(hasComplaint(ctx({ chiefComplaint: '' }))).toBe(false);
  });

  it('summarises name + complaint for the recording strip, clipping long text', () => {
    expect(recordingStripText(ctx())).toBe('Akhilesh · "Tooth pain on upper left, sensitive to cold"');
    expect(recordingStripText(ctx({ chiefComplaint: null }))).toBe('Akhilesh');
    const long = recordingStripText(ctx({ chiefComplaint: 'a'.repeat(120) }), 30);
    expect(long.length).toBeLessThan(45);
    expect(long).toContain('…');
  });

  it('maps gender to a compact label and counts x-rays', () => {
    expect(genderLabel('MALE')).toBe('M');
    expect(genderLabel('FEMALE')).toBe('F');
    expect(xrayCount(ctx({}, [{ id: 'm1', type: 'XRAY', mimeType: 'image/png' }]))).toBe(1);
  });
});
