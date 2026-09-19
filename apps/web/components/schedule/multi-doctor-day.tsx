'use client';

import type { ScheduleAppointment } from '@odovox/types';
import { buildDayLayout, type ClinicHoursLite } from '@/lib/schedule/day-layout';
import { appointmentsForDoctor, deriveDoctorColumns } from '@/lib/schedule/multi-doctor';
import { AppointmentBlock, PX_PER_MIN } from './appointment-block';


/** "Dr. Asha Menon" -> "AM". Skips the honorific, which every column shares. */
function initials(name: string): string {
  const words = name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '?').concat(words[1]?.[0] ?? '').toUpperCase();
}

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
            {/* Initials beside the name, as frame 47 has them — two columns of similar
                text are harder to tell apart at a glance than two marks. */}
            <p className="mb-1 flex items-center justify-center gap-1.5 truncate text-xs font-semibold">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-pill border border-hair-2 text-3xs font-heavy text-pine-3">
                {initials(col.name)}
              </span>
              <span className="truncate">{col.name}</span>
            </p>
            <div className="relative rounded-lg border border-border bg-paper-warm" style={{ height: px(ref.totalMinutes) }}>
              {ref.hourMarks.map((h) => (
                <div key={h.label} className="absolute left-0 right-0 z-0 h-px bg-border" style={{ top: px(h.minutesFromOpen) }} />
              ))}
              {layout.lunch && layout.lunch.heightMinutes > 0 ? (
                <div className="absolute left-0 right-0 bg-ink/[0.04]" style={{ top: px(layout.lunch.topMinutes), height: px(layout.lunch.heightMinutes) }} />
              ) : null}
              <button type="button" aria-label={`Book with ${col.name}`} onClick={() => onTapEmpty(col.doctorId)} className="absolute inset-0" />
              {/* The SAME block the single-doctor view draws. It was a separate, tinted
                  copy — which meant the gridline-through-the-subtitle bug had to be found
                  and fixed twice, and the two columns disagreed about what an appointment
                  looks like. `dense` narrows it for a shared column. */}
              {layout.blocks.map((b) => (
                <AppointmentBlock
                  key={b.id}
                  block={b}
                  tz={tz}
                  top={px(b.topMinutes)}
                  height={px(b.heightMinutes)}
                  onSelect={onSelect}
                  dense={columns.length > 1}
                  inset="left-0.5 right-0.5"
                />
              ))}
              {layout.nowLineMinutes != null ? (
                <div className="pointer-events-none absolute left-0 right-0 z-20 h-[2px] rounded-full bg-lime" style={{ top: px(layout.nowLineMinutes) }} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
