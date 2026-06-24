export type Role = 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';

export type TabIcon =
  | 'home'
  | 'today'
  | 'patients'
  | 'schedule'
  | 'lab'
  | 'clinic'
  | 'billing';

export interface TabDef {
  href: string;
  label: string;
  icon: TabIcon;
}

const DOCTOR_TABS: TabDef[] = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/lab', label: 'Lab', icon: 'lab' },
  { href: '/clinic', label: 'Clinic', icon: 'clinic' },
];

const RECEPTIONIST_TABS: TabDef[] = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/patients', label: 'Patients', icon: 'patients' },
  { href: '/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/lab', label: 'Lab', icon: 'lab' },
  { href: '/billing', label: 'Billing', icon: 'billing' },
];

export function tabsForRole(role: Role): TabDef[] {
  return role === 'RECEPTIONIST' ? RECEPTIONIST_TABS : DOCTOR_TABS;
}

/** Where each role lands after auth. */
export function landingRoute(role: Role): string {
  return role === 'RECEPTIONIST' ? '/today' : '/home';
}

/** Routes only some roles may open. Anything not listed is shared by all roles. */
const RESTRICTED: { prefix: string; roles: Role[] }[] = [
  { prefix: '/home', roles: ['DOCTOR', 'ADMIN'] },
  { prefix: '/clinic', roles: ['DOCTOR', 'ADMIN'] },
  { prefix: '/today', roles: ['RECEPTIONIST', 'ADMIN'] },
  { prefix: '/billing', roles: ['RECEPTIONIST', 'ADMIN'] },
];

export function canAccess(route: string, role: Role): boolean {
  const rule = RESTRICTED.find((r) => route === r.prefix || route.startsWith(`${r.prefix}/`));
  if (!rule) return true; // shared route
  return rule.roles.includes(role);
}
