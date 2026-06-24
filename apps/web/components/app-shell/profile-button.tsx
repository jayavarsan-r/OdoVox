'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Avatar with a small profile menu (logout + read-only role/clinic). */
export function ProfileButton({ className }: { className?: string }) {
  const router = useRouter();
  const { user, activeMembership, clinic, clearSession } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = (user?.name || 'OV').slice(0, 2).toUpperCase();

  const logout = async () => {
    try {
      await api.post('/auth/logout', undefined, { skipAuth: true });
    } catch {
      /* best effort */
    }
    clearSession();
    router.replace('/welcome');
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
        className="relative flex size-11 items-center justify-center rounded-pill bg-ink font-mono text-sm font-semibold tracking-tight text-lime"
      >
        {initials}
        {/* presence dot */}
        <span className="absolute bottom-0 right-0 size-2.5 rounded-pill border-2 border-paper bg-success" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-border bg-surface p-2 shadow-card">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold">{user?.name || 'Your account'}</p>
              <p className="text-xs text-muted-foreground">
                {clinic?.name ?? 'Clinic'} · {activeMembership?.role ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
