/**
 * Timezone helpers for the schedule engine. All appointment instants are stored UTC; the clinic
 * works in wall-clock local time (HH:mm, calendar days). These helpers convert between the two
 * deterministically via `Intl.DateTimeFormat` — pure, no external deps, correct across DST (Odovox
 * defaults to Asia/Kolkata which has no DST, but nothing here hardcodes that).
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function partsMap(instant: Date, tz: string, withWeekday: boolean): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

/** The offset (ms) of `tz` at the given UTC instant: localWallClock - utc. */
function tzOffsetMs(instant: Date, tz: string): number {
  const m = partsMap(instant, tz, false);
  let hour = Number(m.hour ?? '0');
  if (hour === 24) hour = 0; // some engines render midnight as 24
  const asIfUtc = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    hour,
    Number(m.minute),
    Number(m.second),
  );
  return asIfUtc - instant.getTime();
}

/** Break a UTC instant into its wall-clock parts in `tz`. */
export function utcToZonedParts(instant: Date, tz: string): ZonedParts {
  const m = partsMap(instant, tz, true);
  let hour = Number(m.hour ?? '0');
  if (hour === 24) hour = 0;
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour,
    minute: Number(m.minute),
    second: Number(m.second),
    dayOfWeek: WEEKDAY_INDEX[m.weekday ?? 'Sun'] ?? 0,
  };
}

/** Convert a clinic-local wall-clock time to the corresponding UTC instant. */
export function zonedWallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  // First pass: pretend the wall time is UTC, then correct by the offset at that guess. A second
  // pass converges around DST boundaries (a no-op for fixed-offset zones like Asia/Kolkata).
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute);
  let offset = tzOffsetMs(new Date(guessUtc), tz);
  let result = guessUtc - offset;
  offset = tzOffsetMs(new Date(result), tz);
  result = guessUtc - offset;
  return new Date(result);
}

/** Parse "HH:mm" into [hours, minutes]. */
export function parseHHMM(s: string): [number, number] {
  const parts = s.split(':');
  return [Number(parts[0]), Number(parts[1])];
}

/** Build the UTC instant for `dateISO` (YYYY-MM-DD, clinic-local) at wall-clock `hhmm` in `tz`. */
export function localDateTimeToUtc(dateISO: string, hhmm: string, tz: string): Date {
  const d = dateISO.split('-');
  const [h, mi] = parseHHMM(hhmm);
  return zonedWallTimeToUtc(Number(d[0]), Number(d[1]), Number(d[2]), h, mi, tz);
}

/** The clinic-local calendar date (YYYY-MM-DD) of a UTC instant. */
export function localDateISO(instant: Date, tz: string): string {
  const p = utcToZonedParts(instant, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Day-of-week (0=Sun) of a clinic-local calendar date. */
export function dayOfWeekOf(dateISO: string, tz: string): number {
  // Noon avoids any boundary ambiguity.
  return utcToZonedParts(localDateTimeToUtc(dateISO, '12:00', tz), tz).dayOfWeek;
}
