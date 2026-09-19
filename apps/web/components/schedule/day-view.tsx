'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { CalendarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildDayLayout, type ClinicHoursLite } from '@/lib/schedule/day-layout';
import { durationLabel, appointmentSubtitle, appointmentChip } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';

/**
 * 30 min → 48px, matching frame 46's rail spacing.
 *
 * It was 1.2 (36px), which is shorter than two lines of text — so a card showed the patient
 * and clipped the line telling you what they were coming in for. A denser grid that hides
 * half of every row is not denser, it is just smaller.
 */
const PX_PER_MIN = 1.6;

export function DayView({
  dateISO,
  clinicHours,
  appointments,
  forcedOffDay,
  onSelect,
  onTapEmpty,
}: {
  dateISO: string;
  clinicHours: ClinicHoursLite;
  appointments: ScheduleAppointment[];
  forcedOffDay?: boolean;
  onSelect: (a: ScheduleAppointment) => void;
  onTapEmpty?: () => void;
}) {
  const layout = buildDayLayout({ dateISO, clinicHours, appointments, forcedOffDay });
  const tz = clinicHours.timezone;
  const px = (min: number) => `${min * PX_PER_MIN}px`;

  if (layout.isOffDay) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-paper-warm py-16 text-center">
        <CalendarOff className="size-6 text-text-subtle" />
        <p className="text-sm font-medium text-text-subtle">Clinic closed this day</p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: px(layout.totalMinutes) }}>
      {/* Hour grid lines + labels */}
      {layout.hourMarks.map((h) => (
        <div key={h.label} className="absolute left-0 right-0 z-0 flex items-start" style={{ top: px(h.minutesFromOpen) }}>
          <span className="-mt-2 w-12 shrink-0 text-right text-[11px] font-medium tabular-nums text-text-subtle">{h.label}</span>
          <div className="ml-2 mt-[1px] h-px flex-1 bg-border" />
        </div>
      ))}

      {/* Lunch band */}
      {layout.lunch && layout.lunch.heightMinutes > 0 ? (
        <div
          className="absolute left-14 right-0 rounded-md bg-ink/[0.04]"
          style={{ top: px(layout.lunch.topMinutes), height: px(layout.lunch.heightMinutes) }}
        >
          <span className="px-2 text-[11px] italic text-text-subtle">Lunch</span>
        </div>
      ) : null}

      {/* Tappable empty layer */}
      {onTapEmpty ? (
        <button type="button" aria-label="Book an appointment" onClick={onTapEmpty} className="absolute left-14 right-0 top-0 bottom-0 cursor-pointer" />
      ) : null}

      {/* Appointment blocks */}
      {layout.blocks.map((b) => (
        <AppointmentBlock
          key={b.id}
          block={b}
          tz={tz}
          top={px(b.topMinutes)}
          height={px(b.heightMinutes)}
          onSelect={onSelect}
        />
      ))}

      {/* Now line */}
      {layout.nowLineMinutes != null ? (
        /* Lime, not red. Red in this app means a problem — a cancelled case, an allergy
           conflict, a no-show — and "it is currently 10:34" is not a problem. Frame 46 draws
           it in lime, the colour this product uses for "here, now". */
        <div
          className="pointer-events-none absolute left-12 right-0 z-20 flex items-center"
          style={{ top: px(layout.nowLineMinutes) }}
        >
          <span className="size-2 shrink-0 rounded-full bg-lime ring-2 ring-paper" />
          <div className="h-[2px] flex-1 rounded-full bg-lime" />
        </div>
      ) : null}
    </div>
  );
}

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
function AppointmentBlock({
  block: b,
  tz,
  top,
  height,
  onSelect,
}: {
  block: { id: string; tone: string; appt: ScheduleAppointment };
  tz: string;
  top: string;
  height: string;
  onSelect: (a: ScheduleAppointment) => void;
}) {
  const chip = appointmentChip(b.appt.status);
  const subtitle = appointmentSubtitle(b.appt);
  const cancelled = b.appt.status === 'CANCELLED';

  return (
    <button
      type="button"
      onClick={() => onSelect(b.appt)}
      className={cn(
        'absolute left-14 right-0 z-10 flex overflow-hidden rounded-lg bg-white text-left shadow-elev-1',
        'transition-transform active:scale-[0.99]',
        b.appt.status === 'COMPLETED' && 'opacity-70',
      )}
      style={{ top, height }}
    >
      <span className={cn('w-[3px] shrink-0', SPINE[b.tone] ?? 'bg-sage')} />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
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
          {formatLocalTime(new Date(b.appt.startsAt), tz)} · {durationLabel(b.appt.durationMinutes)}
          {subtitle ? ` · ${subtitle}` : ''}
          {b.appt.roomName ? ` · ${b.appt.roomName}` : ''}
        </span>
      </span>
    </button>
  );
}
