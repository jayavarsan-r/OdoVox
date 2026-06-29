import { getAvailableSlots } from './availability.js';
import { localDateISO, localDateTimeToUtc } from './tz.js';
import type { AvailabilityWindow, DayOffInput, ExistingAppointment, ScheduleClinicHours } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LOOKAHEAD_DAYS = 7;

/** Minimal prisma surface the resolver needs (works with a tx client too). */
interface FollowUpPrisma {
  clinic: { findUniqueOrThrow: (a: unknown) => Promise<{ openingTime: string; closingTime: string; lunchStart: string | null; lunchEnd: string | null; weeklyOffDays: number[]; timezone: string }> };
  doctorAvailability: { findMany: (a: unknown) => Promise<Array<{ doctorId: string; dayOfWeek: number; startTime: string; endTime: string; effectiveFrom: Date | null; effectiveTo: Date | null }>> };
  dayOff: { findMany: (a: unknown) => Promise<Array<{ date: Date; endDate: Date | null; scope: string; doctorId: string | null }>> };
  appointment: { findMany: (a: unknown) => Promise<ExistingAppointment[]> };
}

export interface FollowUpResolution {
  startsAt: Date;
  endsAt: Date;
  /** Set when no slot could be found and we fell back to the target date at 10:00 local. */
  warning: string | null;
  resolvedDateISO: string;
}

/**
 * Resolve a voice follow-up ("in N days") to a real, availability-aware slot. Looks at the target
 * date and up to 7 days forward; if nothing fits, falls back to the target date at 10:00 local and
 * surfaces a NO_AVAILABLE_SLOT warning so the doctor reschedules manually. Spec §5.2.
 */
export async function resolveFollowUpSlot(
  prisma: FollowUpPrisma,
  input: { clinicId: string; doctorId: string; afterDays: number; durationMinutes: number; now?: Date },
): Promise<FollowUpResolution> {
  const now = input.now ?? new Date();
  const c = await prisma.clinic.findUniqueOrThrow({
    where: { id: input.clinicId },
    select: { openingTime: true, closingTime: true, lunchStart: true, lunchEnd: true, weeklyOffDays: true, timezone: true },
  });
  const clinicHours: ScheduleClinicHours = {
    open: c.openingTime,
    close: c.closingTime,
    lunchStart: c.lunchStart,
    lunchEnd: c.lunchEnd,
    weeklyOffDays: c.weeklyOffDays,
    timezone: c.timezone,
  };
  const tz = clinicHours.timezone;

  const [availRows, dayOffRows] = await Promise.all([
    prisma.doctorAvailability.findMany({ where: { clinicId: input.clinicId, doctorId: input.doctorId } }),
    prisma.dayOff.findMany({ where: { clinicId: input.clinicId } }),
  ]);
  const availability: AvailabilityWindow[] = availRows.map((r) => ({
    doctorId: r.doctorId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));
  const dayOffs: DayOffInput[] = dayOffRows.map((r) => ({
    date: r.date,
    endDate: r.endDate,
    scope: r.scope as 'CLINIC' | 'DOCTOR',
    doctorId: r.doctorId,
  }));

  const targetMs = now.getTime() + input.afterDays * DAY_MS;
  const windowStart = new Date(targetMs - DAY_MS);
  const windowEnd = new Date(targetMs + (MAX_LOOKAHEAD_DAYS + 1) * DAY_MS);
  const existing: ExistingAppointment[] = await prisma.appointment.findMany({
    where: {
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      deletedAt: null,
      status: { in: ['SCHEDULED', 'CHECKED_IN'] },
      startsAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, doctorId: true, roomId: true, patientId: true, startsAt: true, endsAt: true, status: true },
  });

  const targetISO = localDateISO(new Date(targetMs), tz);
  for (let look = 0; look <= MAX_LOOKAHEAD_DAYS; look++) {
    const dISO = localDateISO(new Date(targetMs + look * DAY_MS), tz);
    const slots = getAvailableSlots({
      dateISO: dISO,
      doctorId: input.doctorId,
      doctorAvailability: availability,
      clinicHours,
      dayOffs,
      existingAppointments: existing,
      durationMinutes: input.durationMinutes,
    });
    if (slots.length > 0) {
      return { startsAt: slots[0]!.startsAt, endsAt: slots[0]!.endsAt, warning: null, resolvedDateISO: dISO };
    }
  }

  // Fallback: target date at 10:00 local, flagged for manual rescheduling.
  const startsAt = localDateTimeToUtc(targetISO, '10:00', tz);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + input.durationMinutes * 60_000),
    warning: `NO_AVAILABLE_SLOT: Suggested ${targetISO} but no slot found — manually reschedule`,
    resolvedDateISO: targetISO,
  };
}
