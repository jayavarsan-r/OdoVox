import { cn } from '@/lib/utils';

/**
 * Ownable single-colour line illustrations for placeholder tabs + small empty
 * states. Style: 1.5px ink stroke, lime accent dots, subtle sage-tint backing.
 * ~144px. See design-system.md §8.
 */

type IlluProps = { className?: string };

const base = 'size-36';
const stroke = 'stroke-ink';
const sw = 1.5;

function Frame({ children, className, tint = 'sage' }: { children: React.ReactNode; className?: string; tint?: 'sage' | 'sky' | 'lavender' | 'peach' }) {
  const tintClass = {
    sage: 'fill-sage-tint',
    sky: 'fill-sky-soft',
    lavender: 'fill-lavender-soft',
    peach: 'fill-peach-soft',
  }[tint];
  return (
    <svg viewBox="0 0 120 120" className={cn(base, className)} fill="none" aria-hidden>
      <circle cx="60" cy="60" r="54" className={tintClass} />
      {children}
    </svg>
  );
}

export function IlluCalendarSoon({ className }: IlluProps) {
  return (
    <Frame className={className} tint="sky">
      <rect x="34" y="38" width="52" height="46" rx="6" className={stroke} strokeWidth={sw} />
      <path d="M34 50h52" className={stroke} strokeWidth={sw} />
      <path d="M46 32v10M74 32v10" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="50" cy="62" r="3" className="fill-lime" />
      <circle cx="62" cy="62" r="3" className="fill-ink" />
      <circle cx="74" cy="62" r="3" className="fill-ink" />
      <circle cx="50" cy="74" r="3" className="fill-ink" />
      <circle cx="62" cy="74" r="3" className="fill-lime" />
    </Frame>
  );
}

export function IlluFlaskSoon({ className }: IlluProps) {
  return (
    <Frame className={className} tint="lavender">
      <path d="M52 34h16v18l16 26a6 6 0 0 1-5 9H41a6 6 0 0 1-5-9l16-26V34Z" className={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M48 34h24" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <path d="M45 70h30" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="54" cy="80" r="3" className="fill-lime" />
      <circle cx="66" cy="76" r="2.5" className="fill-ink" />
    </Frame>
  );
}

export function IlluBuildingSoon({ className }: IlluProps) {
  return (
    <Frame className={className} tint="sage">
      <path d="M40 86V44l20-12 20 12v42" className={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M34 86h52" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <rect x="50" y="66" width="20" height="20" className={stroke} strokeWidth={sw} />
      <path d="M48 52h8M64 52h8M48 60h8M64 60h8" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="60" cy="40" r="3" className="fill-lime" />
    </Frame>
  );
}

export function IlluPaymentSoon({ className }: IlluProps) {
  return (
    <Frame className={className} tint="peach">
      <rect x="32" y="44" width="56" height="36" rx="6" className={stroke} strokeWidth={sw} />
      <path d="M32 56h56" className={stroke} strokeWidth={sw} />
      <path d="M40 70h12" className={stroke} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="74" cy="70" r="5" className="fill-lime" />
      <circle cx="68" cy="70" r="5" className={stroke} strokeWidth={sw} />
    </Frame>
  );
}

export function IlluInventorySoon({ className }: IlluProps) {
  return (
    <Frame className={className} tint="sky">
      <path d="M36 52l24-12 24 12v28L60 92 36 80V52Z" className={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M36 52l24 12 24-12M60 64v28" className={stroke} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx="48" cy="52" r="3" className="fill-lime" />
    </Frame>
  );
}

export function IlluHappyTooth({ className }: IlluProps) {
  return (
    <Frame className={className} tint="sage">
      <path
        d="M60 36c-12 0-16 5-22 5-5 0-9 4-9 12 0 8 3 13 5 20 2 6 1 12 4 18 1 4 3 8 5 8s4-4 5-10c1-6 1-12 5-12h4c4 0 4 6 5 12 1 6 3 10 5 10s4-4 5-8c3-6 2-12 4-18 2-7 5-12 5-20 0-8-4-12-9-12-6 0-10-5-22-5Z"
        className={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path d="M50 58c3 3 17 3 20 0" className="stroke-lime" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="52" cy="50" r="2" className="fill-ink" />
      <circle cx="68" cy="50" r="2" className="fill-ink" />
    </Frame>
  );
}
