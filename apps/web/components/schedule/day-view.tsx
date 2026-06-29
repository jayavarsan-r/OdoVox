'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { CalendarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildDayLayout, type ClinicHoursLite } from '@/lib/schedule/day-layout';
import { toneClass, durationLabel, appointmentSubtitle } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';

const PX_PER_MIN = 1.2; // 30 min → 36px

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
        <div key={h.label} className="absolute left-0 right-0 flex items-start" style={{ top: px(h.minutesFromOpen) }}>
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
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.appt)}
          className={cn(
            'absolute left-14 right-0 overflow-hidden rounded-lg border px-3 py-1.5 text-left shadow-elev-1 transition-transform active:scale-[0.99]',
            toneClass(b.tone),
            b.appt.status === 'COMPLETED' && 'opacity-60',
          )}
          style={{ top: px(b.topMinutes), height: px(b.heightMinutes) }}
        >
          <p className="truncate text-xs font-semibold">
            {formatLocalTime(new Date(b.appt.startsAt), tz)} · {durationLabel(b.appt.durationMinutes)} · {b.appt.patientName}
          </p>
          {appointmentSubtitle(b.appt) ? <p className="truncate text-[11px] text-ink/70">{appointmentSubtitle(b.appt)}</p> : null}
          {b.appt.roomName ? <p className="truncate text-[11px] text-ink/60">{b.appt.roomName}</p> : null}
        </button>
      ))}

      {/* Now line */}
      {layout.nowLineMinutes != null ? (
        <div className="absolute left-12 right-0 z-10 flex items-center" style={{ top: px(layout.nowLineMinutes) }}>
          <span className="size-2 rounded-full bg-destructive" />
          <div className="h-px flex-1 bg-destructive" />
        </div>
      ) : null}
    </div>
  );
}
