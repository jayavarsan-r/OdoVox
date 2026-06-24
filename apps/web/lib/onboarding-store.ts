'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ClinicCreateInput, DoctorProfileInput } from '@odovox/types';

/**
 * Ephemeral onboarding state, persisted to sessionStorage so a refresh mid-flow doesn't lose
 * the user's progress. Cleared once onboarding completes.
 */

export type OnboardingRole = 'DOCTOR' | 'RECEPTIONIST';

interface OnboardingState {
  phone: string | null;
  role: OnboardingRole | null;
  clinicData: Partial<ClinicCreateInput> | null;
  doctorProfile: Partial<DoctorProfileInput> | null;
  setPhone: (phone: string) => void;
  setRole: (role: OnboardingRole) => void;
  setClinicData: (data: Partial<ClinicCreateInput>) => void;
  setDoctorProfile: (data: Partial<DoctorProfileInput>) => void;
  reset: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      phone: null,
      role: null,
      clinicData: null,
      doctorProfile: null,
      setPhone: (phone) => set({ phone }),
      setRole: (role) => set({ role }),
      // Merge so multi-step wizard data survives back/forward navigation.
      setClinicData: (data) => set((s) => ({ clinicData: { ...s.clinicData, ...data } })),
      setDoctorProfile: (data) =>
        set((s) => ({ doctorProfile: { ...s.doctorProfile, ...data } })),
      reset: () => set({ phone: null, role: null, clinicData: null, doctorProfile: null }),
    }),
    {
      name: 'odovox-onboarding',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as never),
      ),
    },
  ),
);
