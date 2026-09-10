/**
 * The last few things this user searched for (frame 33's "Recent" chips).
 *
 * Front-desk search is repetitive — the same family calls back, the same patient is looked
 * up twice in an hour — so the previous queries are usually the next one. Kept in
 * localStorage because it is a convenience, not a record: losing it costs a retype, and it
 * must never travel to the server, where it would become a log of who a clinic looked up.
 */
const KEY = "odovox:recent-patient-searches";
const MAX = 6;

/** Newest first, de-duplicated case-insensitively, capped. Pure, so it is testable. */
export function pushRecent(list: string[], query: string): string[] {
  const q = query.trim();
  if (!q) return list;
  const rest = list.filter((r) => r.toLowerCase() !== q.toLowerCase());
  return [q, ...rest].slice(0, MAX);
}

export function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    // Anything could be in localStorage — another tab, an older build, a user poking at
    // devtools. Bad data must degrade to "no recents", never to a crashed search screen.
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveRecent(query: string): string[] {
  const next = pushRecent(readRecents(), query);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode, or a full quota. The chips are a nicety; search still works.
  }
  return next;
}
