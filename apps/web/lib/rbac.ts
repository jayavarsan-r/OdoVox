export type Role = "DOCTOR" | "RECEPTIONIST" | "ADMIN";

export type TabIcon =
  | "home"
  | "today"
  | "patients"
  | "schedule"
  | "lab"
  | "clinic"
  | "billing"
  | "more";

export interface TabDef {
  href: string;
  label: string;
  icon: TabIcon;
}

/**
 * v9 navigation: FOUR tabs plus the orb (frames 12–81, every nav instance).
 *
 * Lab, Clinic and Billing lost their tab slot to `/more` (frame 70, the module hub).
 * They are NOT removed: every route keeps its path, its RBAC rule and its direct
 * linkability, and each is reachable from the hub. The glass pill is dimensioned for
 * four tabs plus a 52px active capsule; a fifth does not fit at 390px.
 */
const DOCTOR_TABS: TabDef[] = [
  { href: "/home", label: "Flow", icon: "home" },
  { href: "/patients", label: "Patients", icon: "patients" },
  { href: "/schedule", label: "Schedule", icon: "schedule" },
  { href: "/more", label: "More", icon: "more" },
];

const RECEPTIONIST_TABS: TabDef[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/patients", label: "Patients", icon: "patients" },
  { href: "/schedule", label: "Schedule", icon: "schedule" },
  { href: "/more", label: "More", icon: "more" },
];

export function tabsForRole(role: Role): TabDef[] {
  return role === "RECEPTIONIST" ? RECEPTIONIST_TABS : DOCTOR_TABS;
}

/** Where each role lands after auth. */
export function landingRoute(role: Role): string {
  return role === "RECEPTIONIST" ? "/today" : "/home";
}

/** Routes only some roles may open. Anything not listed is shared by all roles. */
const RESTRICTED: { prefix: string; roles: Role[] }[] = [
  { prefix: "/home", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/clinic", roles: ["DOCTOR", "ADMIN"] },
  // /consult carries clinical detail — the in-chair card shows the patient's medical
  // flags so the doctor about to record sees an allergy before they prescribe. It was a
  // SHARED route: not in the receptionist tab bar, but reachable by URL, which would have
  // put those flags in front of reception. Restricted so the clinical surface and the
  // people entitled to it stay the same set.
  { prefix: "/consult", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/today", roles: ["RECEPTIONIST", "ADMIN"] },
  { prefix: "/billing", roles: ["RECEPTIONIST", "ADMIN"] },
];

export function canAccess(route: string, role: Role): boolean {
  const rule = RESTRICTED.find(
    (r) => route === r.prefix || route.startsWith(`${r.prefix}/`),
  );
  if (!rule) return true; // shared route
  return rule.roles.includes(role);
}
