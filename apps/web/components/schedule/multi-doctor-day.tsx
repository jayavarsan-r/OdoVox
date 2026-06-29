'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { cn } from '@/lib/utils';
import { buildDayLayout, type ClinicHoursLite } from '@/lib/schedule/day-layout';
import { appointmentsForDoctor, deriveDoctorColumns } from '@/lib/schedule/multi-doctor';
import { toneClass } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';

const PX_PER_MIN = 1.2;

export function MultiDoctorDay({
  dateISO,
  clinicHours,
  appointments,
  knownDoctors,
  forcedOffDay,
  onSelect,
  onTapEmpty,
}: {
  dateISO: string;
  clinicHours: ClinicHoursLite;
  appointments: ScheduleAppointment[];
  knownDoctors: Array<{ id: string; name: string }>;
  forcedOffDay?: boolean;
  onSelect: (a: ScheduleAppointment) => void;
  onTapEmpty: (doctorId: string) => void;
}) {
  const columns = deriveDoctorColumns(appointments, knownDoctors);
  const tz = clinicHours.timezone;
  // A reference layout (any doctor) for the shared gutter geometry.
  const ref = buildDayLayout({ dateISO, clinicHours, appointments: [], forcedOffDay });
  const px = (min: number) => `${min * PX_PER_MIN}px`;

  if (ref.isOffDay) {
    return <div className="rounded-xl border border-dashed border-border bg-paper-warm py-16 text-center text-sm text-text-subtle">Clinic closed this day</div>;
  }
  if (columns.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-paper-warm py-16 text-center text-sm text-text-subtle">No doctors working this day</div>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto">
      {/* Hour gutter */}
      <div className="relative w-10 shrink-0" style={{ height: px(ref.totalMinutes) }}>
        {ref.hourMarks.map((h) => (
          <span key={h.label} className="absolute right-0 -mt-2 text-[10px] tabular-nums text-text-subtle" style={{ top: px(h.minutesFromOpen) }}>
            {h.label}
          </span>
        ))}
      </div>

      {/* Doctor columns */}
      {columns.map((col) => {
        const layout = buildDayLayout({ dateISO, clinicHours, appointments: appointmentsForDoctor(appointments, col.doctorId) });
        return (
          <div key={col.doctorId} className="min-w-[140px] flex-1">
            <p className="mb-1 truncate text-center text-xs font-semibold">{col.name}</p>
            <div className="relative rounded-lg border border-border bg-paper-warm" style={{ height: px(ref.totalMinutes) }}>
              {ref.hourMarks.map((h) => (
                <div key={h.label} className="absolute left-0 right-0 h-px bg-border" style={{ top: px(h.minutesFromOpen) }} />
              ))}
              {layout.lunch && layout.lunch.heightMinutes > 0 ? (
                <div className="absolute left-0 right-0 bg-ink/[0.04]" style={{ top: px(layout.lunch.topMinutes), height: px(layout.lunch.heightMinutes) }} />
              ) : null}
              <button type="button" aria-label={`Book with ${col.name}`} onClick={() => onTapEmpty(col.doctorId)} className="absolute inset-0" />
              {layout.blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelect(b.appt)}
                  className={cn('absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left', toneClass(b.tone), b.appt.status === 'COMPLETED' && 'opacity-60')}
                  style={{ top: px(b.topMinutes), height: px(b.heightMinutes) }}
                >
                  <p className="truncate text-[11px] font-semibold">{formatLocalTime(new Date(b.appt.startsAt), tz)}</p>
                  <p className="truncate text-[10px] text-ink/70">{b.appt.patientName}</p>
                </button>
              ))}
              {layout.nowLineMinutes != null ? (
                <div className="absolute left-0 right-0 z-10 h-px bg-destructive" style={{ top: px(layout.nowLineMinutes) }} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
