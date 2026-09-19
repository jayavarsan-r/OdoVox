'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { CalendarOff } from 'lucide-react';
import { buildDayLayout, type ClinicHoursLite } from '@/lib/schedule/day-layout';
import { AppointmentBlock, PX_PER_MIN } from './appointment-block';


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
