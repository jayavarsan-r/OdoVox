/**
 * Which medicine on the sheet a safety warning is about.
 *
 * The warnings are the SERVER's — `allergy_conflict:Amoxicillin` from the extraction
 * safety layer, keyed by the drug it flagged. This maps them onto the rows so the flag
 * appears on the medicine it concerns rather than in a banner the doctor has to correlate.
 *
 * It deliberately does NOT decide what conflicts. Matching drug names against a patient's
 * allergies client-side would mean asserting that amoxicillin is a penicillin — real
 * clinical knowledge this app does not have (#51), and product rule 7 forbids converting
 * that kind of uncertainty into clinical truth. If the server did not flag it, nothing here
 * invents a flag.
 */
export interface RxWarning {
  /** e.g. "allergy_conflict:Amoxicillin" or a plain message. */
  raw: string;
}

/** Human half of a `code:detail` warning: "Conflicts with penicillin allergy". */
export function warningLabel(raw: string, allergies: string | null): string {
  const code = raw.split(':')[0] ?? raw;
  if (code === 'allergy_conflict') {
    const what = allergies?.trim();
    return what ? `Conflicts with ${what.toLowerCase()} allergy` : 'Conflicts with a recorded allergy';
  }
  if (code === 'drug_interaction') return 'Interacts with another medicine here';
  // An unrecognised code is shown as-is rather than guessed at — better an unfamiliar
  // string than a confident wrong sentence on a prescription.
  return raw.replace(/_/g, ' ');
}

/** The warnings that name this medicine, by the drug the server keyed them to. */
export function warningsFor(medicineName: string, warnings: string[]): string[] {
  const name = medicineName.trim().toLowerCase();
  if (!name) return [];
  return warnings.filter((w) => {
    const detail = w.split(':')[1]?.trim().toLowerCase();
    return !!detail && detail === name;
  });
}
