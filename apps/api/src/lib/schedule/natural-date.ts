import * as chrono from 'chrono-node';

/**
 * Phase 9.7 W1.2.5 — natural spoken dates ("next Monday", "tomorrow 10am", "Aug 15",
 * "2 weeks from now") → a UTC instant in the clinic's timezone. chrono-node does the parsing;
 * we feed it the clinic's UTC offset so "10am" means 10am at the clinic, not on the server.
 * Returns null when nothing parseable is found (the card falls back to a manual picker).
 */

/** Offset minutes of an IANA timezone at a given instant (DST-safe, no extra deps). */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

export interface ParsedNaturalDate {
  /** UTC instant. */
  date: Date;
  /** The exact text chrono matched ("next monday at 10 am"). */
  matchedText: string;
  /** False when chrono had to assume the time of day (card should highlight the time). */
  hasTime: boolean;
}

export function parseNaturalDate(text: string, tz: string, now: Date = new Date()): ParsedNaturalDate | null {
  const results = chrono.parse(text, { instant: now, timezone: tzOffsetMinutes(tz, now) }, { forwardDate: true });
  const first = results[0];
  if (!first) return null;
  return {
    date: first.date(),
    matchedText: first.text,
    hasTime: first.start.isCertain('hour'),
  };
}
