'use client';

import { create } from 'zustand';
import type { ClinicMemberResponse } from '@odovox/types';

/**
 * Session store. The access token lives in memory only (never localStorage) — it's short
 * lived and re-minted from the httpOnly refresh cookie on reload via /auth/refresh.
 */

export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
}

export interface SessionClinic {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  activeMembership: ClinicMemberResponse | null;
  clinic: SessionClinic | null;
  setSession: (s: {
    accessToken: string;
    user: SessionUser;
    activeMembership?: ClinicMemberResponse | null;
    clinic?: SessionClinic | null;
  }) => void;
  setAccessToken: (token: string) => void;
  setMembership: (m: ClinicMemberResponse | null, clinic?: SessionClinic | null) => void;
  clearSession: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  activeMembership: null,
  clinic: null,
  setSession: ({ accessToken, user, activeMembership = null, clinic = null }) =>
    set({ accessToken, user, activeMembership, clinic }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setMembership: (activeMembership, clinic = null) => set({ activeMembership, clinic }),
  clearSession: () => set({ accessToken: null, user: null, activeMembership: null, clinic: null }),
}));
