'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { cn } from '@/lib/utils';
import { durationLabel, appointmentSubtitle, appointmentChip } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';

/**
 * Grid scale: 30 min → 48px.
 *
 * Defined ONCE and exported, because it was defined twice — 1.6 here and 1.2 in the
 * multi-doctor grid — and the two had already drifted. A card is sized in minutes by one
 * file and positioned in minutes by another; when they disagree, the second line of every
 * appointment is clipped and it looks like a rendering bug rather than arithmetic.
 */
export const PX_PER_MIN = 1.6;

/** The tone spine — a 3px bar, not a tinted fill. */
const SPINE: Record<string, string> = {
  sage: 'bg-sage',
  sky: 'bg-sky',
  peach: 'bg-peach',
  lavender: 'bg-lavender',
};

const CHIP_TONE: Record<string, string> = {
  live: 'bg-live-soft text-live',
  sky: 'bg-sky-soft text-sky',
  neutral: 'bg-[rgba(31,42,35,0.06)] text-pine-3',
  crit: 'bg-crit-soft text-crit',
};

/**
 * One appointment on the day grid.
 *
 * White, with a coloured SPINE, as frame 46 draws it — not a tinted fill. The fill was
 * translucent, so the hour gridline behind it showed straight through the subtitle and every
 * row read as struck through. In this app struck-through text means cancelled, so a full day
 * of ordinary appointments looked like a full day of cancellations.
 *
 * The PATIENT leads. The time is already the row's position on the grid — printing it again
 * as the first thing you read spends the strongest position on the one fact the layout has
 * already told you.
 */
export function AppointmentBlock({
  block: b,
  tz,
  top,
  height,
  onSelect,
  dense = false,
  inset = 'left-14 right-0',
}: {
  block: { id: string; tone: string; appt: ScheduleAppointment };
  tz: string;
  top: string;
  height: string;
  onSelect: (a: ScheduleAppointment) => void;
  /** A shared multi-doctor column is half the width — drop the second line rather than clip it. */
  dense?: boolean;
  /** Horizontal placement, owned by whichever grid is drawing this. */
  inset?: string;
}) {
  const chip = appointmentChip(b.appt.status);
  const subtitle = appointmentSubtitle(b.appt);
  const cancelled = b.appt.status === 'CANCELLED';

  return (
    <button
      type="button"
      onClick={() => onSelect(b.appt)}
      className={cn(
        'absolute z-10 flex overflow-hidden rounded-lg bg-white text-left shadow-elev-1',
        // The PARENT owns horizontal placement: the single-doctor grid reserves a 56px
        // gutter for hour labels, a shared column has its own. Tying that to `dense` meant a
        // one-doctor column inherited the wrong gutter and the cards overflowed it.
        inset,
        'transition-transform active:scale-[0.99]',
        b.appt.status === 'COMPLETED' && 'opacity-70',
      )}
      style={{ top, height }}
    >
      <span className={cn('w-[3px] shrink-0', SPINE[b.tone] ?? 'bg-sage')} />
      <span className={cn('flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5', dense ? 'px-1.5' : 'px-2.5')}>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[13px] font-heavy text-pine',
              cancelled && 'line-through',
            )}
          >
            {b.appt.patientName}
          </span>
          {chip ? (
            <span
              className={cn(
                'shrink-0 rounded-2xs px-1.5 py-0.5 text-3xs font-heavy',
                CHIP_TONE[chip.tone],
              )}
            >
              {chip.label}
            </span>
          ) : null}
        </span>
        <span className="truncate text-3xs font-semibold text-pine-3">
          {formatLocalTime(new Date(b.appt.startsAt), tz)}
          {dense ? '' : ` · ${durationLabel(b.appt.durationMinutes)}`}
          {!dense && subtitle ? ` · ${subtitle}` : ''}
          {!dense && b.appt.roomName ? ` · ${b.appt.roomName}` : ''}
        </span>
      </span>
    </button>
  );
}
