import type { JourneySitting } from "@/components/ds";

/**
 * Frame 38's sitting journey.
 *
 * The clinical/operational split (owner ruling B4) is already enforced at the API: for a
 * receptionist, `/plans/:id` returns `notes: null` and never calls decryptField. So this
 * builds the subtitle from whatever it was given — a doctor's response carries the note
 * and reception's does not, and neither branch of this function knows or cares which role
 * is asking. That is deliberate: a UI-level role check here would be a second place for
 * the boundary to be wrong.
 *
 * Everything else on the line is operational and shown to both: the date, the sitting
 * number, whether it is done, and whether the next one is booked.
 */

export interface PlanSittingLike {
  id: string;
  sittingNumber: number;
  date: string | Date;
  completed: boolean;
  /** Clinical prose. Null for roles not entitled to it — enforced server-side. */
  notes: string | null;
  visitId: string | null;
}

/** "28 Jun" in clinic-local terms. */
function shortDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Build the journey.
 *
 * `now` is the first incomplete sitting that has a visit — the one actually underway.
 * Everything after it is `ahead`. A plan whose sittings are all complete has no `now`,
 * which is correct: nothing is happening.
 *
 * An incomplete sitting with no visit has not started, so its date is the day it was
 * planned rather than a day anyone attended — it is left off the line rather than
 * presented as if the patient came in.
 */
export function caseJourney(
  sittings: PlanSittingLike[],
  procedureName: string,
): JourneySitting[] {
  const nowIdx = sittings.findIndex((s) => !s.completed && s.visitId != null);

  return sittings.map((s, i) => {
    const state: JourneySitting["state"] = s.completed
      ? "done"
      : i === nowIdx
        ? "now"
        : "ahead";

    const parts: string[] = [];
    // Only a sitting that actually happened gets a date on it.
    if (s.completed || state === "now") parts.push(shortDate(s.date));
    if (state === "now") parts.push("in progress");
    // Present only for roles the API sends it to.
    if (s.notes?.trim()) parts.push(s.notes.trim());

    return {
      id: s.id,
      title: `Sitting ${s.sittingNumber} · ${procedureName}`,
      subtitle: parts.length > 0 ? parts.join(" · ") : undefined,
      state,
      short: String(s.sittingNumber),
    };
  });
}
