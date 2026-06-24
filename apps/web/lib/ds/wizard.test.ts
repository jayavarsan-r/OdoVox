import { describe, expect, it } from 'vitest';
import {
  WIZARD_STEPS,
  isStepComplete,
  mergeWizard,
  stepRoute,
  validateClinicSubmission,
} from './wizard';

const basics = {
  name: 'Smile Dental Care',
  contactPhone: '9876543210',
  addressLine: '12 MG Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  gstNumber: '',
};

const hours = {
  openingTime: '09:00',
  closingTime: '18:00',
  weeklyOffDays: [0],
  chairsCount: 2,
};

const profile = {
  doctorName: 'Dr. Asha Menon',
};

const doctorProfile = {
  qualification: 'BDS',
  registrationNumber: 'KA-DENT-12345',
  specialization: ['General'],
};

describe('wizard step config', () => {
  it('defines three steps mapped to their routes', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual(['basics', 'hours', 'profile']);
    expect(stepRoute('basics')).toBe('/clinic-create/step-1-basics');
    expect(stepRoute('hours')).toBe('/clinic-create/step-2-hours');
    expect(stepRoute('profile')).toBe('/clinic-create/step-3-profile');
  });
});

describe('isStepComplete', () => {
  it('accepts a fully filled basics step', () => {
    expect(isStepComplete('basics', basics)).toBe(true);
  });

  it('rejects an incomplete basics step', () => {
    expect(isStepComplete('basics', { ...basics, pincode: '12' })).toBe(false);
  });

  it('accepts hours without an optional lunch break', () => {
    expect(isStepComplete('hours', hours)).toBe(true);
  });

  it('requires doctor name + qualification + registration for the profile step', () => {
    expect(isStepComplete('profile', { ...profile, ...doctorProfile })).toBe(true);
    expect(isStepComplete('profile', { doctorName: 'Dr. Asha Menon' })).toBe(false);
  });
});

describe('mergeWizard + validateClinicSubmission', () => {
  it('merges the two store slices into one payload', () => {
    const merged = mergeWizard({ ...basics, ...hours, ...profile }, doctorProfile);
    expect(merged.qualification).toBe('BDS');
    expect(merged.name).toBe('Smile Dental Care');
  });

  it('accepts a complete merged submission', () => {
    const merged = mergeWizard({ ...basics, ...hours, ...profile }, doctorProfile);
    expect(validateClinicSubmission(merged).success).toBe(true);
  });

  it('rejects a partial submission (missing later steps)', () => {
    const merged = mergeWizard(basics, null);
    expect(validateClinicSubmission(merged).success).toBe(false);
  });

  it('tolerates null/undefined slices', () => {
    expect(mergeWizard(null, null)).toEqual({});
  });
});
