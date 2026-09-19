/**
 * The in-chair card's clinical indicator (frame 21).
 *
 * Ruled: keep the allergy indicator, make it concise and high-signal — "Penicillin
 * allergy", not a dump of medical history — and build it from the medicalFlags the queue
 * payload already carries. Nothing here invents medical data or reaches for a new field:
 * `QueuePatientZ.medicalFlags` is the only source, and the encrypted `allergies` column
 * deliberately never travels to the queue.
 */

/** Flags that name an allergy. These lead, because they change what may be prescribed. */
function isAllergy(flag: string): boolean {
  return /allerg/i.test(flag);
}

/**
 * Human form for a stored flag: `PENICILLIN_ALLERGY` → `Penicillin allergy`,
 * `HYPERTENSION` → `Hypertension`. Flags already written as prose are left alone.
 */
export function flagLabel(flag: string): string {
  const raw = flag.trim();
  if (!raw) return "";
  // Screaming snake / kebab is the stored convention; anything else is already readable.
  const looksCoded = /^[A-Z0-9_\s-]+$/.test(raw) && raw === raw.toUpperCase();
  const words = looksCoded ? raw.replace(/[_-]+/g, " ").toLowerCase() : raw;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface FlagChip {
  label: string;
  /** Allergies are crit; everything else is a quieter warning. */
  tone: "crit" | "warn";
}

/**
 * Up to `max` chips, allergies first.
 *
 * Capped on purpose. A patient with six flags would otherwise push the card's actions off
 * screen and turn the one line a doctor must not miss into a wall they skim past — which
 * is the failure mode the ruling calls "a dump of medical history". The overflow is
 * counted, never silently dropped, so the card still says there is more to read.
 */
export function flagChips(
  flags: string[],
  max = 2,
): { chips: FlagChip[]; more: number } {
  const clean = flags.map((f) => f.trim()).filter(Boolean);
  const ordered = [
    ...clean.filter(isAllergy),
    ...clean.filter((f) => !isAllergy(f)),
  ];
  const chips = ordered.slice(0, max).map((f) => ({
    label: flagLabel(f),
    tone: isAllergy(f) ? ("crit" as const) : ("warn" as const),
  }));
  return { chips, more: Math.max(0, ordered.length - chips.length) };
}
