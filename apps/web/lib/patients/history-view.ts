import type { HistoryEntry } from '@odovox/types';

/**
 * Frame 42 groups the timeline under month headings, newest first.
 *
 * Permanent facts have no date (a recorded allergy carries no timestamp), and the frame
 * still shows one — pinned to the end of the timeline, after the dated entries, because
 * that is where the oldest thing on a patient's record belongs and because it is true of
 * every month rather than any one of them.
 */
export interface HistoryGroup {
  /** "JULY 2026", or null for the undated tail. */
  label: string | null;
  entries: HistoryEntry[];
}

const MONTH = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export function groupHistory(entries: HistoryEntry[]): HistoryGroup[] {
  const dated = entries.filter((e) => e.at != null);
  const undated = entries.filter((e) => e.at == null);

  dated.sort((a, b) => +new Date(b.at!) - +new Date(a.at!));

  const groups: HistoryGroup[] = [];
  for (const e of dated) {
    const label = MONTH.format(new Date(e.at!)).toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(e);
    else groups.push({ label, entries: [e] });
  }
  if (undated.length) groups.push({ label: null, entries: undated });
  return groups;
}

/** Frame 42's card sub-line: "36 · ₹3,000 · Dr. Priya", dropping what is absent. */
export function entryFacts(e: HistoryEntry): string[] {
  const facts: string[] = [];
  if (e.teeth.length) facts.push(e.teeth.join(', '));
  if (e.feePaise != null) facts.push(`₹${(e.feePaise / 100).toLocaleString('en-IN')}`);
  if (e.prescriptionCount > 0) facts.push(`${e.prescriptionCount} Rx`);
  if (e.doctorName) facts.push(e.doctorName);
  if (e.detail) facts.push(e.detail);
  return facts;
}
