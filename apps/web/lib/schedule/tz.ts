/**
 * Clinic-local time helpers for the calendar UI. Appointment instants are UTC; the clinic works in
 * wall-clock local time. Deterministic via Intl — mirrors the API's tz helpers (no shared import:
 * the API lib isn't part of the web build).
 */

function parts(instant: Date, tz: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const out: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) if (p.type !== 'literal') out[p.type] = p.value;
  return out;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Minutes since clinic-local midnight (0-1439). */
export function localMinutesOfDay(instant: Date, tz: string): number {
  const p = parts(instant, tz);
  let h = Number(p.hour ?? '0');
  if (h === 24) h = 0;
  return h * 60 + Number(p.minute ?? '0');
}

/** Clinic-local calendar date, YYYY-MM-DD. */
export function localDateISO(instant: Date, tz: string): string {
  const p = parts(instant, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Day-of-week (0=Sun) of a clinic-local instant. */
export function localDayOfWeek(instant: Date, tz: string): number {
  return WEEKDAY[parts(instant, tz).weekday ?? 'Sun'] ?? 0;
}

/** "HH:mm" → minutes since midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** Format an instant as a clinic-local 12-hour time, e.g. "9:00 AM". */
export function formatLocalTime(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(instant);
}

/** Day-of-week index (0=Sun) of a YYYY-MM-DD calendar date (tz-agnostic). */
export function dayOfWeekOfISO(dateISO: string): number {
  const p = dateISO.split('-');
  return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))).getUTCDay();
}

/** Add days to a YYYY-MM-DD calendar date. */
export function addDaysISO(dateISO: string, n: number): string {
  const p = dateISO.split('-');
  const dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Today's clinic-local calendar date. */
export function todayISO(tz: string, now: Date = new Date()): string {
  return localDateISO(now, tz);
}
