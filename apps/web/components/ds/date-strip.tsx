'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * A date you pick with your thumb.
 *
 * This replaces `<input type="date">`, which on a phone drops the operating system's own
 * calendar — system-blue, system-typeface, nothing like the screen around it — on top of a
 * carefully made surface, and then asks a receptionist to hit a 24px number.
 *
 * WHY NATIVE SCROLL RATHER THAN A POINTER-DRAG CAROUSEL. Every property that makes a strip
 * like this feel Apple-made already lives in the platform's scroller: 1:1 tracking, momentum
 * projected from release velocity, the ability to grab it mid-flight and reverse it, and
 * rubber-banding at the ends. Hand-rolling those with pointer events means reimplementing
 * physics the browser has already tuned per platform — and losing keyboard, trackpad and
 * screen-reader scrolling on the way. So the scroller is the browser's; scroll-snap decides
 * where it comes to rest; and the only thing written here is what a day LOOKS like.
 *
 * Feedback is on press, not release (`active:scale-95` at 100ms), because the moment
 * acknowledgement waits for touch-up the whole thing stops feeling direct.
 */

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Local-midnight ISO (YYYY-MM-DD) — never `toISOString()`, which converts to UTC first. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  out.setHours(0, 0, 0, 0);
  return out;
}

export interface DateStripProps {
  /** Selected date as YYYY-MM-DD, or '' for none. */
  value: string;
  onChange: (iso: string) => void;
  /** How many days forward to offer. */
  days?: number;
  /** Days before today. 0 means the strip starts today — the default, because you cannot
   *  close a day that has already happened. */
  daysBefore?: number;
  className?: string;
}

export function DateStrip({
  value,
  onChange,
  days = 60,
  daysBefore = 0,
  className,
}: DateStripProps) {
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dates = useMemo(
    () => Array.from({ length: days + daysBefore }, (_, i) => addDays(today, i - daysBefore)),
    [today, days, daysBefore],
  );

  /** The month shown in the header follows the strip rather than the selection, so scrolling
   *  through November tells you it is November before you have committed to a day. */
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    value ? new Date(`${value}T12:00:00`) : today,
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      // Coalesce to one read per frame: scroll fires far more often than the display refreshes,
      // and each read here forces layout.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const centre = el.scrollLeft + el.clientWidth / 2;
        const child = el.children[0] as HTMLElement | undefined;
        if (!child) return;
        const step = child.offsetWidth + 8; // width + gap
        const idx = Math.min(dates.length - 1, Math.max(0, Math.round(centre / step - 0.5)));
        const d = dates[idx];
        if (d && d.getMonth() !== visibleMonth.getMonth()) setVisibleMonth(d);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dates, visibleMonth]);

  /** Bring the selection into view when it changes from outside (a quick chip). */
  useEffect(() => {
    if (!value) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-iso="${value}"]`);
    el?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [value, reduced]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="px-1 text-2xs font-heavy tracking-[0.06em] text-pine-3">
        {visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
      </p>

      <div
        ref={scroller}
        // `snap-x mandatory` lets the browser choose the resting day from its own momentum
        // projection — the same curve it uses for every other scroller on the device.
        className={cn(
          '-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1',
          // The scrollbar is noise on a 72px-tall strip that is obviously scrollable.
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {dates.map((d) => {
          const iso = toISO(d);
          const selected = iso === value;
          const isToday = iso === toISO(today);
          return (
            <motion.button
              key={iso}
              data-iso={iso}
              type="button"
              onClick={() => onChange(selected ? '' : iso)}
              aria-pressed={selected}
              aria-label={d.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              initial={false}
              // Critically damped by default; the small overshoot is reserved for the one
              // element that just became selected, where it reads as "this is now the day".
              animate={{ scale: selected && !reduced ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className={cn(
                // 56x72 — comfortably past the 44px minimum, because this is chosen at a
                // front desk with one hand while a phone is held in the other.
                'flex size-[56px] h-[72px] shrink-0 snap-center flex-col items-center justify-center gap-1 rounded-2xl',
                'transition-[transform,background-color,color] duration-press ease-out active:scale-95',
                selected
                  ? 'bg-pine text-white shadow-elev-1'
                  : 'bg-white text-pine shadow-elev-1 active:bg-[rgba(31,42,35,0.04)]',
              )}
            >
              <span
                className={cn('text-3xs font-heavy', selected ? 'text-white/70' : 'text-pine-3')}
              >
                {DAY_LETTER[d.getDay()]}
              </span>
              <span className="text-[17px] font-black leading-none tabular-nums">
                {d.getDate()}
              </span>
              {/* Today keeps a mark even when another day is selected, so the strip never
                  loses its anchor. */}
              <span
                className={cn(
                  'size-1 rounded-full',
                  isToday ? (selected ? 'bg-lime' : 'bg-pine') : 'bg-transparent',
                )}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The two answers that cover most of the question.
 *
 * Closing the clinic is nearly always about today or tomorrow — a dentist is ill, the water
 * is off — and making someone scroll a calendar to say "today" is the kind of friction that
 * gets a booking system abandoned. Anything further out is what the strip is for.
 */
export function DateQuickChips({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const options = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return [
      { label: 'Today', iso: toISO(t) },
      { label: 'Tomorrow', iso: toISO(addDays(t, 1)) },
      // The next Monday is when a planned closure usually starts.
      {
        label: 'Next Monday',
        iso: toISO(addDays(t, (1 - t.getDay() + 7) % 7 || 7)),
      },
    ];
  }, []);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(value === o.iso ? '' : o.iso)}
          aria-pressed={value === o.iso}
          className={cn(
            'rounded-pill px-[14px] py-2 text-xs font-heavy',
            'transition-[transform,background-color,color] duration-press ease-out active:scale-95',
            value === o.iso
              ? 'bg-pine text-white'
              : 'bg-[rgba(31,42,35,0.05)] text-pine active:bg-[rgba(31,42,35,0.09)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
