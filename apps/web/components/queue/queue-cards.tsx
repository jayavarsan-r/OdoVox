'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, RotateCcw, ChevronRight, Info, CircleDot } from 'lucide-react';
import type { VisitWithPatient } from '@odovox/types';
import { GlassCard } from '@/components/ds';
import { springScale } from '@/components/ds/motion';
import { Button } from '@/components/ui/button';
import { rupees } from '@/lib/queue/checkout-form';
import { cn } from '@/lib/utils';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_TONES = ['bg-sage-soft', 'bg-peach-soft', 'bg-sky-soft', 'bg-lavender'];

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <span
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-pill text-sm font-semibold text-ink', tone, className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function useElapsed(since: Date | string | null): string {
  const [, force] = useState(0);
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Doctor's in-chair hero card (glass allowed — it's a hero surface, §12.1). */
export function InChairCard({
  visit,
  onRecord,
  onReturn,
  busyRecord,
  busyReturn,
}: {
  visit: VisitWithPatient;
  onRecord: () => void;
  onReturn: () => void;
  busyRecord?: boolean;
  busyReturn?: boolean;
}) {
  const elapsed = useElapsed(visit.calledInAt);
  return (
    <motion.div layoutId={`visit-${visit.id}`} {...springScale}>
      <GlassCard tone="light">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sage-deep">
              <span>Now treating · Token {visit.tokenNumber}</span>
              {visit.recording ? (
                <span className="inline-flex items-center gap-1 text-danger">
                  <CircleDot className="size-3 animate-pulse" /> recording
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 truncate text-2xl font-semibold text-ink">{visit.patient.name}</h2>
            <p className="mt-0.5 truncate text-sm text-text-muted">
              {visit.patient.age} · {visit.chiefComplaint ?? '—'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {visit.roomName ? <p className="text-xs font-medium text-text-muted">{visit.roomName}</p> : null}
            {elapsed ? <p className="font-mono text-sm tabular-nums text-ink">{elapsed}</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="primary" onClick={onRecord} loading={busyRecord}>
            <Mic /> Record findings
          </Button>
          <Button variant="ghost" onClick={onReturn} loading={busyReturn}>
            <RotateCcw /> Return to queue
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/** A waiting patient row (doctor + receptionist). The lime flash on entry signals "just arrived". */
export function WaitingRow({
  visit,
  onCallIn,
  calling,
  onOpen,
  onLongPress,
}: {
  visit: VisitWithPatient;
  onCallIn?: () => void;
  calling?: boolean;
  onOpen?: () => void;
  onLongPress?: () => void;
}) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  const startPress = () => {
    if (!onLongPress) return;
    pressTimer = setTimeout(onLongPress, 500);
  };
  const endPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };
  return (
    <motion.div
      layoutId={`visit-${visit.id}`}
      {...springScale}
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-elev-1"
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
    >
      <motion.div
        initial={{ backgroundColor: 'rgba(212,245,100,0.5)' }}
        animate={{ backgroundColor: 'rgba(212,245,100,0)' }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3 p-3"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onOpen}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
        >
          <InitialsAvatar name={visit.patient.name} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 truncate font-medium text-ink">
              {visit.patient.name}
              {visit.priority > 0 ? <span className="rounded-pill bg-peach-soft px-1.5 text-[10px] font-semibold text-ink">PRIORITY</span> : null}
              {onOpen ? <Info className="size-3.5 shrink-0 text-text-subtle" /> : null}
            </span>
            <span className="truncate text-xs text-text-muted">
              {visit.patient.age} · {visit.chiefComplaint ?? 'Walk-in'}
            </span>
          </span>
        </button>
        {onCallIn ? (
          <Button size="sm" variant="primary" onClick={onCallIn} loading={calling}>
            Call in
          </Button>
        ) : (
          <span className="font-mono text-xs tabular-nums text-text-subtle">#{visit.tokenNumber}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Checkout card — view-only for the doctor; with a "Take payment" CTA for the receptionist. */
export function CheckoutRow({ visit, onTakePayment }: { visit: VisitWithPatient; onTakePayment?: () => void }) {
  return (
    <motion.div
      layoutId={`visit-${visit.id}`}
      {...springScale}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border p-3',
        onTakePayment ? 'bg-surface shadow-elev-1' : 'bg-paper-warm opacity-80',
      )}
    >
      <InitialsAvatar name={visit.patient.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{visit.patient.name}</p>
        <p className="truncate text-xs text-text-muted">
          {visit.doctorName ?? '—'}
          {visit.billDuePaise != null ? ` · ${rupees(visit.billDuePaise)} due` : ''}
        </p>
      </div>
      {onTakePayment ? (
        <Button size="sm" variant="secondary" onClick={onTakePayment}>
          <ChevronRight className="rotate-0" /> Take payment
        </Button>
      ) : (
        <span className="text-xs font-medium text-text-subtle">Checkout</span>
      )}
    </motion.div>
  );
}
