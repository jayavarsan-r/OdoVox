'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile-shell';
import { BottomTabs } from '@/components/app-shell/bottom-tabs';
import { Spinner } from '@/components/ui/spinner';
import { api, ApiError } from '@/lib/api-client';
import { useAuth, type SessionClinic, type SessionUser } from '@/lib/auth';
import { canAccess, landingRoute, type Role } from '@/lib/rbac';
import { useRealtime } from '@/lib/realtime/use-realtime';
import type { ClinicMemberResponse } from '@odovox/types';

interface MeResponse {
  user: SessionUser;
  activeMembership: ClinicMemberResponse | null;
  clinic: SessionClinic | null;
}

const TOP_LEVEL = ['/home', '/today', '/patients', '/schedule', '/lab', '/clinic', '/billing'];

/**
 * Authenticated shell: bootstraps the session from the refresh cookie, enforces RBAC, and
 * renders the role-based bottom tabs on top-level routes (hidden on detail/modal routes).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeMembership, setSession } = useAuth();
  const [ready, setReady] = useState(false);

  // App-wide realtime: connects the queue socket once authed, keeps the store live, reconciles on
  // focus, tears down on logout. Safe to call unconditionally — it no-ops until a session exists.
  useRealtime();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<MeResponse>('/auth/me');
        if (cancelled) return;
        if (!me.activeMembership) {
          router.replace('/role');
          return;
        }
        setSession({
          accessToken: useAuth.getState().accessToken ?? '',
          user: me.user,
          activeMembership: me.activeMembership,
          clinic: me.clinic,
        });
        setReady(true);
      } catch (err) {
        // api-client already redirects to /welcome on a failed refresh.
        if (err instanceof ApiError && err.status === 401) return;
        router.replace('/welcome');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setSession]);

  const role = (activeMembership?.role ?? null) as Role | null;

  // RBAC: bounce to the role's landing route if this one isn't allowed.
  useEffect(() => {
    if (ready && role && !canAccess(pathname, role)) {
      router.replace(landingRoute(role));
    }
  }, [ready, role, pathname, router]);

  if (!ready || !role) {
    return (
      <MobileShell className="items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </MobileShell>
    );
  }

  const showTabs = TOP_LEVEL.includes(pathname);

  // Phase 2.6: every (app) route is clean paper — no gradient wash, no tint (see §12.1).
  return (
    <MobileShell className="bg-paper">
      <main className={showTabs ? 'flex flex-1 flex-col pb-28' : 'flex flex-1 flex-col'}>{children}</main>
      {showTabs ? <BottomTabs role={role} /> : null}
    </MobileShell>
  );
}
