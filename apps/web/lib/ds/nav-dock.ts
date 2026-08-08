import type { Role } from "@/lib/rbac";

/**
 * What the orb does, per role and per screen (v9 frame 78).
 *
 * "Tap = context action: patient in chair → start/continue recording; on Consult →
 *  record; anywhere else → jump to Consult."
 *
 * The orb is role-shaped: a doctor's core act is dictating (mic), a receptionist's is
 * adding (＋). Frame 77 makes that swap the headline consequence of switching roles.
 *
 * Kept out of the component so the routing is inspectable and tested — an orb that
 * lands on the wrong screen is the most-tapped bug you could ship.
 */
export interface OrbAction {
  icon: "mic" | "plus";
  href: string;
  /** Accessible name; must describe what a tap does, not what the control is. */
  label: string;
  /** The extra lime-soft ring, shown when the orb's own tab is the current screen. */
  highlighted: boolean;
}

export function orbAction(role: Role, pathname: string): OrbAction {
  if (role === "RECEPTIONIST") {
    return {
      icon: "plus",
      href: "/today",
      label: "Add a walk-in, appointment or payment",
      // Reception's orb creates rather than navigating, so it is never "on its own tab".
      highlighted: false,
    };
  }

  const onConsult = pathname === "/consult" || pathname.startsWith("/consult/");
  return {
    icon: "mic",
    href: "/consult",
    label: onConsult ? "Record this consultation" : "Go to Consult and record",
    highlighted: onConsult,
  };
}
