import type { ScheduleAppointment } from '@odovox/types';

export type ProcedureTone = 'sage' | 'sky' | 'peach' | 'lavender';

/**
 * Map a procedure hint to a calendar block tone (§7.1): cleaning → sky, new/consult → peach,
 * specialist → lavender, everything clinical → sage (default).
 */
export function procedureTone(hint: string | null | undefined): ProcedureTone {
  const h = (hint ?? '').toLowerCase();
  if (/clean|scal|polish|hygien/.test(h)) return 'sky';
  if (/new|consult|check.?up|first|intake/.test(h)) return 'peach';
  if (/ortho|implant|surg|specialist|perio|endo/.test(h)) return 'lavender';
  return 'sage';
}

const TONE_CLASS: Record<ProcedureTone, string> = {
  sage: 'bg-sage-soft border-sage text-ink',
  sky: 'bg-sky-soft border-sky text-ink',
  peach: 'bg-peach-soft border-peach text-ink',
  lavender: 'bg-lavender-soft border-lavender text-ink',
};

export function toneClass(tone: ProcedureTone): string {
  return TONE_CLASS[tone];
}

/** "30m", "1h", "1h 30m". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** A short, human appointment subtitle: procedure · sitting, e.g. "RCT · Sitting 3 of 4". */
export function appointmentSubtitle(a: Pick<ScheduleAppointment, 'procedureHint' | 'seriesIndex' | 'seriesTotal' | 'sittingNumber'>): string {
  const bits: string[] = [];
  if (a.procedureHint) bits.push(a.procedureHint);
  if (a.seriesTotal && a.seriesIndex) bits.push(`Sitting ${a.seriesIndex} of ${a.seriesTotal}`);
  else if (a.sittingNumber) bits.push(`Sitting ${a.sittingNumber}`);
  return bits.join(' · ');
}
