'use client';

import { cn } from '@/lib/utils';

/**
 * The patient screen's small shared pieces. They live together because all five tabs
 * reach for them, and because Task 22 restyles them in one place rather than five.
 */
export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-text-subtle">{title.toUpperCase()}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-muted">
      <div className="h-full rounded-pill bg-lime" style={{ width: `${percent}%` }} />
    </div>
  );
}
export function QuickAction({ label, icon, accent, onClick }: { label: string; icon: React.ReactNode; accent: string; onClick: () => void }) {
  // Mini light-hero tile: elevated + scale-on-tap (kept vertical for the 3-up grid).
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-border/60 p-3 text-left shadow-elev-2 transition-transform active:scale-95',
        accent,
      )}
    >
      <span className="text-ink">{icon}</span>
      <span className="text-xs font-medium text-ink">{label}</span>
    </button>
  );
}
