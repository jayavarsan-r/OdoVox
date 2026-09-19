/**
 * Dose-dot logic for `<DoseDots>` (v9-44).
 *
 * The spec renders dosing as three positional dots — morning, afternoon, night —
 * rather than the "1-0-1" shorthand, because ●○● is legible across a room while a
 * digit string is not. This maps the prescription frequency codes the API already
 * stores onto that pattern.
 */

/** Frequencies as stored on `Prescription.medicines[].frequency`. */
export type DoseFrequency = "OD" | "BD" | "TID" | "QID" | "SOS";

const PATTERNS: Record<DoseFrequency, boolean[]> = {
  OD: [true, false, false], // once daily — morning
  BD: [true, false, true], // twice daily — morning + night
  TID: [true, true, true], // three times daily
  QID: [true, true, true], // four times daily; three slots is the display ceiling
  SOS: [false, false, false], // as needed — no fixed slot
};

/**
 * Map a frequency code to its three-slot pattern. Unknown or missing values fall back
 * to the SOS pattern (all hollow) rather than inventing a schedule — a wrong dose
 * pattern on a prescription is worse than an empty one.
 */
export function doseDotsFromFrequency(frequency?: string | null): boolean[] {
  if (!frequency) return PATTERNS.SOS;
  const key = frequency.trim().toUpperCase() as DoseFrequency;
  return PATTERNS[key] ?? PATTERNS.SOS;
}

/** How many doses a day the pattern represents — used for the sr-only summary. */
export function dosesPerDay(pattern: boolean[]): number {
  return pattern.filter(Boolean).length;
}
