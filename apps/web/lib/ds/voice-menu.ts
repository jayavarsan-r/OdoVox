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
  | "find-patient"
  | "walk-in"
  | "payment"
  /** Free-form: capture speech and let the intent router decide where it goes. */
  | "dictate";

export interface VoiceMenuRow {
  id: VoiceIntentId;
  label: string;
  /** Second line — carries the patient identity on the consultation row. */
  sublabel?: string;
  /** The lime `.hot` row: the primary action for the current context. */
  hot: boolean;
  /**
   * Where the row goes. NULL means the row is not a navigation at all — it captures
   * speech and lets `routeVoiceCommand` choose the destination. Only `dictate` does
   * this, and it is the reason the orb can be the single voice affordance: without it
   * the menu is five shortcuts, not a voice surface.
   */
  href: string | null;
}

export interface VoiceMenuContext {
  /** Name of the patient currently in the chair, if any. */
  inChairName?: string | null;
  /** Their visit id, so the consultation row can go straight there. */
  inChairVisitId?: string | null;
  /**
   * Reception gets two rows a doctor does not. The orb is now the ONLY floating action
   * surface, so anything that used to live on a screen's own FAB has to be reachable
   * from here or it is simply gone.
   */
  role?: "DOCTOR" | "RECEPTIONIST" | "ADMIN" | null;
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
    // Reception's own actions, previously on /today's floating FAB. Removing that FAB
    // without moving these would have deleted the front desk's two most-used shortcuts.
    // ADMIN too: an admin can reach /billing and the walk-in flow, and on a small
    // clinic's single device the admin IS the front desk.
    ...(ctx.role === "RECEPTIONIST" || ctx.role === "ADMIN"
      ? [
          {
            id: "walk-in" as const,
            label: "Add walk-in",
            hot: false,
            href: "/today?walkin=1",
          },
          {
            id: "payment" as const,
            label: "Take a payment",
            hot: false,
            href: "/billing",
          },
        ]
      : []),
    {
      // Frame 78's menu is five shortcuts; this sixth row is what makes the orb a VOICE
      // affordance rather than a launcher. `href: null` because the destination is not
      // known until the sentence is spoken — `routeVoiceCommand` decides it.
      id: "dictate",
      label: "Say something else…",
      sublabel: "consult · book · inventory · patient",
      hot: false,
      href: null,
    },
  ];
}
