import type { RecurringInterval } from '@odovox/types';
import { addDaysISO } from './tz.js';

export interface PreviewRow {
  index: number; // 1-based
  dateISO: string;
}

function addInterval(baseISO: string, interval: RecurringInterval, i: number): string {
  if (interval === 'WEEKLY') return addDaysISO(baseISO, 7 * i);
  if (interval === 'BIWEEKLY') return addDaysISO(baseISO, 14 * i);
  // MONTHLY — calendar month add.
  const p = baseISO.split('-');
  const dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + i, Number(p[2])));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Client-side preview of a recurring series' target dates (the server is authoritative and may roll
 * occurrences forward to the next free slot). Used by the multi-sitting "Schedule remaining" card.
 */
export function previewSeries(input: {
  firstDateISO: string;
  interval: RecurringInterval;
  totalOccurrences: number;
}): PreviewRow[] {
  return Array.from({ length: input.totalOccurrences }, (_, i) => ({
    index: i + 1,
    dateISO: addInterval(input.firstDateISO, input.interval, i),
  }));
}
