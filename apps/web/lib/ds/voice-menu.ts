/**
 * Voice-menu contents (v9 frame 78).
 *
 * The spec's rule for this surface is a SAFETY rule, not a copy rule:
 *
 *   "First item always names who it will record — no accidental recordings."
 *
 * The orb's hold is reachable from anywhere in the app, including screens with no
 * patient context. If the first row said "Start consultation" with no name, a hold
 * from the wrong screen could begin recording against whoever the app happened to
 * consider current. So when nobody is in the chair, the row must say so and route to
 * the queue instead of starting anything.
 */

export type VoiceIntentId =
  | "consultation"
  | "new-patient"
  | "book"
  | "lab-case"
  | "find-patient";

export interface VoiceMenuRow {
  id: VoiceIntentId;
  label: string;
  /** Second line — carries the patient identity on the consultation row. */
  sublabel?: string;
  /** The lime `.hot` row: the primary action for the current context. */
  hot: boolean;
  href: string;
}

export interface VoiceMenuContext {
  /** Name of the patient currently in the chair, if any. */
  inChairName?: string | null;
  /** Their visit id, so the consultation row can go straight there. */
  inChairVisitId?: string | null;
}

export function voiceMenuRows(ctx: VoiceMenuContext): VoiceMenuRow[] {
  const hasPatient = Boolean(ctx.inChairName);

  return [
    {
      id: "consultation",
      // Named, always. A bare "Start consultation" is what makes an accidental
      // recording possible.
      label: hasPatient ? "Start consultation" : "No one in the chair",
      sublabel: hasPatient
        ? `${ctx.inChairName} · in chair`
        : "Open the queue to call someone in",
      // Only "hot" when there is actually someone to record.
      hot: hasPatient,
      href:
        hasPatient && ctx.inChairVisitId
          ? `/consult/${ctx.inChairVisitId}`
          : "/consult",
    },
    {
      id: "new-patient",
      label: "New patient by voice",
      hot: false,
      href: "/patients/new?dictate=1",
    },
    {
      id: "book",
      label: "Book appointment",
      hot: false,
      href: "/schedule?dictate=1",
    },
    {
      id: "lab-case",
      label: "New lab case",
      hot: false,
      href: "/lab/new?dictate=1",
    },
    {
      id: "find-patient",
      label: "Find a patient",
      hot: false,
      href: "/patients",
    },
  ];
}
