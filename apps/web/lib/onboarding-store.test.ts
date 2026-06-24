import '../test/window-polyfill'; // must precede the store import (sessionStorage)
import { beforeEach, describe, expect, it } from 'vitest';
import { useOnboarding } from './onboarding-store';

/**
 * The clinic wizard relies on the onboarding store MERGING slices so back/forward
 * navigation never loses earlier steps. These guard that contract.
 */
beforeEach(() => {
  useOnboarding.getState().reset();
});

describe('onboarding store — wizard persistence', () => {
  it('merges clinicData across forward navigation', () => {
    const s = useOnboarding.getState();
    s.setClinicData({ name: 'Smile Dental', city: 'Bengaluru' });
    s.setClinicData({ openingTime: '09:00', chairsCount: 3 });
    expect(useOnboarding.getState().clinicData).toMatchObject({
      name: 'Smile Dental',
      city: 'Bengaluru',
      openingTime: '09:00',
      chairsCount: 3,
    });
  });

  it('preserves later-step data when an earlier step is re-edited (back nav)', () => {
    const s = useOnboarding.getState();
    s.setClinicData({ name: 'Smile Dental', city: 'Bengaluru' });
    s.setClinicData({ openingTime: '10:00' });
    // user goes back to step 1 and changes only the name
    s.setClinicData({ name: 'Bright Smile' });
    expect(useOnboarding.getState().clinicData).toMatchObject({
      name: 'Bright Smile',
      city: 'Bengaluru',
      openingTime: '10:00',
    });
  });

  it('merges the doctorProfile slice independently', () => {
    const s = useOnboarding.getState();
    s.setDoctorProfile({ qualification: 'BDS' });
    s.setDoctorProfile({ registrationNumber: 'KA-123' });
    expect(useOnboarding.getState().doctorProfile).toMatchObject({
      qualification: 'BDS',
      registrationNumber: 'KA-123',
    });
  });

  it('reset clears all slices after submission', () => {
    const s = useOnboarding.getState();
    s.setClinicData({ name: 'Smile Dental' });
    s.setDoctorProfile({ qualification: 'MDS' });
    s.reset();
    const after = useOnboarding.getState();
    expect(after.clinicData).toBeNull();
    expect(after.doctorProfile).toBeNull();
  });
});
