import { cn } from '@/lib/utils';

/** Phase 2.5 design-system illustrations (named per docs/design-system.md §8). */
export {
  IlluCalendarSoon,
  IlluFlaskSoon,
  IlluBuildingSoon,
  IlluPaymentSoon,
  IlluInventorySoon,
  IlluHappyTooth,
} from './line-illustrations';
export { MascotMoment } from './mascot-moment';
export { DecorativeArt } from './decorative-art';

/** Small hand-drawn-ish SVGs for empty/placeholder states. Phase 10 replaces with real art. */

export function ToothInProgress({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('size-24', className)} fill="none" aria-hidden>
      <circle cx="48" cy="48" r="44" className="fill-lime-soft" />
      <path
        d="M48 28c-9 0-12 4-17 4-4 0-7 3-7 9 0 6 2 10 4 16 1 4 1 9 2 13 1 3 2 6 4 6 2 0 3-3 3-7 1-5 1-9 4-9h6c3 0 3 4 4 9 0 4 1 7 3 7 2 0 3-3 4-6 1-4 1-9 2-13 2-6 4-10 4-16 0-6-3-9-7-9-5 0-8-4-16-4Z"
        className="fill-ink"
      />
      <circle cx="70" cy="30" r="12" className="fill-peach" />
      <path d="M70 25v10M65 30h10" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function HappyTooth({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('size-24', className)} fill="none" aria-hidden>
      <circle cx="48" cy="48" r="44" className="fill-sage-soft" />
      <path
        d="M48 28c-9 0-12 4-17 4-4 0-7 3-7 9 0 6 2 10 4 16 1 4 1 9 2 13 1 3 2 6 4 6 2 0 3-3 3-7 1-5 1-9 4-9h6c3 0 3 4 4 9 0 4 1 7 3 7 2 0 3-3 4-6 1-4 1-9 2-13 2-6 4-10 4-16 0-6-3-9-7-9-5 0-8-4-16-4Z"
        className="fill-ink"
      />
      <path d="M40 50c2 3 14 3 16 0" className="stroke-lime" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarSoon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('size-24', className)} fill="none" aria-hidden>
      <circle cx="48" cy="48" r="44" className="fill-sky-soft" />
      <rect x="28" y="30" width="40" height="38" rx="6" className="fill-ink" />
      <rect x="28" y="30" width="40" height="12" rx="6" className="fill-sky" />
      <path d="M36 26v8M60 26v8" className="stroke-ink" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="54" r="4" className="fill-lime" />
    </svg>
  );
}

export function FlaskSoon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('size-24', className)} fill="none" aria-hidden>
      <circle cx="48" cy="48" r="44" className="fill-lavender-soft" />
      <path d="M42 26h12v16l12 22a6 6 0 0 1-5 9H35a6 6 0 0 1-5-9l12-22V26Z" className="fill-ink" />
      <path d="M38 52h20" className="stroke-lavender" strokeWidth="3" strokeLinecap="round" />
      <circle cx="44" cy="60" r="3" className="fill-lime" />
    </svg>
  );
}

export function EmptyBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('size-24', className)} fill="none" aria-hidden>
      <circle cx="48" cy="48" r="44" className="fill-paper-warm" />
      <path d="M30 42l18-10 18 10-18 10-18-10Z" className="fill-ink" />
      <path d="M30 42v18l18 10V52L30 42Z" className="fill-ink-soft" />
      <path d="M66 42v18L48 70V52l18-10Z" className="fill-ink" opacity="0.8" />
    </svg>
  );
}
