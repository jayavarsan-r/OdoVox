'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { ScheduleAppointment } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading } from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { WeekStrip } from '@/components/schedule/week-strip';
import { DayView } from '@/components/schedule/day-view';
import { MultiDoctorDay } from '@/components/schedule/multi-doctor-day';
import { NewAppointmentSheet } from '@/components/schedule/new-appointment-sheet';
import { AppointmentDetailSheet } from '@/components/schedule/appointment-detail-sheet';
import { useSchedule } from '@/lib/schedule/api';
import { localDateISO } from '@/lib/schedule/tz';
import { useScheduleRealtime } from '@/lib/schedule/use-schedule-realtime';
import { useAuth } from '@/lib/auth';

const FALLBACK_TZ = 'Asia/Kolkata';

function dayOffCoversISO(
  dayOffs: { date: string; endDate: string | null; scope: string; doctorId: string | null }[],
  iso: string,
  myDoctorId: string | null,
): boolean {
  return dayOffs.some((d) => {
    if (d.scope === 'DOCTOR' && d.doctorId !== myDoctorId) return false;
    const from = d.date.slice(0, 10);
    const to = (d.endDate ?? d.date).slice(0, 10);
    return iso >= from && iso <= to;
  });
}

export default function SchedulePage() {
  const membership = useAuth((s) => s.activeMembership);
  const isDoctor = membership?.role === 'DOCTOR';
  const myDoctorId = membership?.userId ?? null;
  const doctorParam = isDoctor ? 'me' : 'all';

  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  // Home voice command "book…" lands here with ?dictate=1 (+ the spoken command in ?q=).
  const voiceParam = searchParams.get('dictate') === '1';
  const voiceText = searchParams.get('q') ?? undefined;
  const [focusISO, setFocusISO] = useState(() =>
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : localDateISO(new Date(), FALLBACK_TZ),
  );
  const [newOpen, setNewOpen] = useState(voiceParam);
  const [prefillDoctorId, setPrefillDoctorId] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<ScheduleAppointment | null>(null);

  const schedule = useSchedule(focusISO, focusISO, doctorParam);
  useScheduleRealtime();
  const tz = schedule.data?.clinicHours.timezone ?? FALLBACK_TZ;
  const todayISO = localDateISO(new Date(), tz);
  const clinicHours = schedule.data?.clinicHours ?? {
    open: '09:00',
    close: '18:00',
    lunchStart: null,
    lunchEnd: null,
    weeklyOffDays: [0],
    timezone: tz,
  };

  const appointments = schedule.data?.appointments ?? [];
  const doctors = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appointments) if (a.doctorName) map.set(a.doctorId, a.doctorName);
    if (isDoctor && myDoctorId && !map.has(myDoctorId)) map.set(myDoctorId, 'Me');
    return [...map].map(([id, name]) => ({ id, name }));
  }, [appointments, isDoctor, myDoctorId]);

  const forcedOffDay = dayOffCoversISO(schedule.data?.dayOffs ?? [], focusISO, myDoctorId);

  return (
    <AnimatedPage className="flex flex-1 flex-col bg-paper">
      <div className="px-5 pt-4">
        <EditorialHeading eyebrow="SCHEDULE" title="Schedule" trailing={<ProfileButton />} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-28 pt-4">
        <WeekStrip focusISO={focusISO} todayISO={todayISO} weeklyOffDays={clinicHours.weeklyOffDays} onFocus={setFocusISO} />

        {schedule.isLoading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : isDoctor ? (
          <DayView
            dateISO={focusISO}
            clinicHours={clinicHours}
            appointments={appointments}
            forcedOffDay={forcedOffDay}
            onSelect={setDetail}
            onTapEmpty={() => { setPrefillDoctorId(myDoctorId ?? undefined); setNewOpen(true); }}
          />
        ) : (
          <MultiDoctorDay
            dateISO={focusISO}
            clinicHours={clinicHours}
            forcedOffDay={forcedOffDay}
            appointments={appointments}
            knownDoctors={doctors}
            onSelect={setDetail}
            onTapEmpty={(docId) => { setPrefillDoctorId(docId); setNewOpen(true); }}
          />
        )}
      </div>

      <button
        type="button"
        aria-label="New appointment"
        onClick={() => setNewOpen(true)}
        className="fixed bottom-24 right-5 z-20 flex size-14 items-center justify-center rounded-pill bg-lime text-ink shadow-[var(--shadow-lime)] active:scale-95"
      >
        <Plus className="size-6" />
      </button>

      <NewAppointmentSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        tz={tz}
        defaultDateISO={focusISO}
        doctors={doctors}
        lockedDoctorId={isDoctor ? myDoctorId ?? undefined : undefined}
        defaultDoctorId={prefillDoctorId}
        voice={voiceParam}
        voiceText={voiceText}
      />
      <AppointmentDetailSheet appt={detail} tz={tz} onClose={() => setDetail(null)} />
    </AnimatedPage>
  );
}
