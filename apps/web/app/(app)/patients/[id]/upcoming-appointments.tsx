'use client';

import { usePatientAppointments } from '@/lib/schedule/api';
import { appointmentSubtitle } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';
import { Section } from './ui-bits';

/** The patient's next appointments — read by Overview. */
const CLINIC_TZ = 'Asia/Kolkata';
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function UpcomingAppointments({ patientId }: { patientId: string }) {
  const { data } = usePatientAppointments(patientId);
  const appts = data?.appointments ?? [];
  if (appts.length === 0) return null;
  return (
    <Section title={`Upcoming appointments · ${appts.length}`}>
      <ul className="flex flex-col gap-2">
        {appts.map((a) => {
          const d = new Date(a.startsAt);
          const dateLabel = `${DAY3[d.getDay()]} ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: CLINIC_TZ })}`;
          const sub = appointmentSubtitle(a);
          return (
            <li key={a.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium tabular-nums">{dateLabel} {formatLocalTime(d, CLINIC_TZ)}</span>
              {sub ? <span className="text-text-muted"> — {sub}</span> : null}
              {a.doctorName ? <span className="text-text-muted"> — {a.doctorName}</span> : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

