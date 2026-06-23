'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api, ApiError } from '@/lib/api-client';
import { useAuth, type SessionClinic, type SessionUser } from '@/lib/auth';
import type { ClinicMemberResponse } from '@odovox/types';

interface MeResponse {
  user: SessionUser;
  activeMembership: ClinicMemberResponse | null;
  clinic: SessionClinic | null;
}

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  ADMIN: 'Admin',
};

export default function HomePage() {
  const router = useRouter();
  const { user, activeMembership, clinic, setSession, clearSession } = useAuth();
  const [loading, setLoading] = useState(!user);
  const [loggingOut, setLoggingOut] = useState(false);

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
      } catch (err) {
        // api-client already redirects to /welcome when refresh fails.
        if (err instanceof ApiError && err.status !== 401) {
          toast.error('Could not load your workspace.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setSession]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout', undefined, { skipAuth: true });
    } catch {
      // best effort
    }
    clearSession();
    router.replace('/welcome');
  };

  if (loading) {
    return (
      <MobileShell className="items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </MobileShell>
    );
  }

  const role = activeMembership?.role ?? 'RECEPTIONIST';
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';
  const name = user?.name || 'there';
  const greeting = isDoctor ? `Hi, Dr. ${name}` : `Hi, ${name}`;
  const initials = (user?.name || 'OV').slice(0, 2).toUpperCase();

  return (
    <MobileShell className="px-5">
      <GradientMesh preset="one" />
      <header className="flex items-center gap-3 pt-6">
        <span className="flex size-12 items-center justify-center rounded-pill bg-ink text-base font-semibold text-lime">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{greeting}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-sm text-muted-foreground">
              {clinic?.name ?? 'Your clinic'}
            </span>
            <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
          </div>
        </div>
      </header>

      <div className="mt-8 flex-1">
        <Card className="bg-surface">
          <CardContent className="space-y-2 p-6">
            <h2 className="text-base font-semibold">You&apos;re all set up 🎉</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Patient management, voice consultations, and your full workflow arrive next. This is
              just the foundation — Phase 1 of 10.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="pb-8 pt-4">
        <Button variant="ghost" className="w-full" onClick={logout} disabled={loggingOut}>
          {loggingOut ? <Spinner /> : null}
          Log out
        </Button>
      </div>
    </MobileShell>
  );
}
