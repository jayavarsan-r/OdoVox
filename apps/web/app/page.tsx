'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { useAuth, type SessionClinic, type SessionUser } from '@/lib/auth';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { MascotMoment } from '@/components/illustrations';
import { LogoLockup } from '@/components/ui/logo';
import { Spinner } from '@/components/ui/spinner';
import type { ClinicMemberResponse } from '@odovox/types';

interface MeResponse {
  user: SessionUser;
  activeMembership: ClinicMemberResponse | null;
  clinic: SessionClinic | null;
}

/**
 * Splash router. Re-mints an access token from the refresh cookie, fetches the session, and
 * routes the user to home / role-select / welcome with no flash of unstyled content.
 *
 * (Implemented client-side rather than as a server component: the access token is held in
 * memory and the refresh cookie is scoped to /auth on the API origin, so the token exchange
 * belongs in the browser.)
 */
export default function SplashPage() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { accessToken } = await api.post<{ accessToken: string }>(
          '/auth/refresh',
          undefined,
          { skipAuth: true },
        );
        useAuth.getState().setAccessToken(accessToken);
        const me = await api.get<MeResponse>('/auth/me');
        useAuth.getState().setSession({
          accessToken,
          user: me.user,
          activeMembership: me.activeMembership,
          clinic: me.clinic,
        });
        router.replace(me.activeMembership ? '/home' : '/role');
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // Network or unexpected — still send the user somewhere usable.
        }
        useAuth.getState().clearSession();
        router.replace('/welcome');
      }
    })();
  }, [router]);

  return (
    <MobileShell className="items-center justify-center">
      <GradientMesh variant="warm" />
      <div className="flex flex-col items-center gap-6">
        <MascotMoment pose="hero" size="lg" animation="float" />
        <LogoLockup />
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    </MobileShell>
  );
}
