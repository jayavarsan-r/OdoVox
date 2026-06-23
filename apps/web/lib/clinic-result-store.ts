'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Handoff for the post-creation /done screen, persisted so a refresh there survives. */
interface ClinicResultState {
  clinicName: string | null;
  city: string | null;
  joinCode: string | null;
  set: (r: { clinicName: string; city: string; joinCode: string }) => void;
  clear: () => void;
}

export const useClinicResult = create<ClinicResultState>()(
  persist(
    (set) => ({
      clinicName: null,
      city: null,
      joinCode: null,
      set: ({ clinicName, city, joinCode }) => set({ clinicName, city, joinCode }),
      clear: () => set({ clinicName: null, city: null, joinCode: null }),
    }),
    {
      name: 'odovox-clinic-result',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : (undefined as never),
      ),
    },
  ),
);
