/**
 * Avatar helpers (v9 `.av`).
 *
 * Initials are the default identity in the spec — clinic records rarely carry photos,
 * and a letter pair is legible at 24px where a cropped face is not.
 */

/**
 * Two-letter initials from a name.
 *
 * Takes the first letter of the first two words, skipping honorifics ("Dr.") so
 * "Dr. Priya Raghavan" reads PR, not DP. Falls back to the first two letters of a
 * single word, and to "?" for empty input — never an empty circle, which reads as a
 * loading state that never resolves.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\b(dr|prof|mr|mrs|ms|shri|smt)\.?\s+/gi, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Ring tones, in the spec's status meaning. */
export type AvatarRing = "lime" | "live" | "sky" | "none" | "bare";

/** Queue state → ring tone. Keeps the mapping in one place, not per-screen. */
export function ringForQueueState(
  state: string | null | undefined,
): AvatarRing {
  switch (state) {
    case "IN_CHAIR":
      return "live";
    case "WAITING":
    case "SCHEDULED":
    case "CHECKED_IN":
      return "sky";
    default:
      return "none";
  }
}
