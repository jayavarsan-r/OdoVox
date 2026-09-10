/**
 * `consultHeroSubtitle` lived here until the Flow states landed. Each state now renders
 * its own line — the in-chair hero reads `heroClinicalLine`, chair-free shows the waiting
 * count as a Mini — so the helper had no caller left. Removed rather than kept: a tested,
 * exported function nothing can reach is the same trap `routeVoiceCommand` fell into, where
 * a green suite reported health for code the app could not run.
 */
/**
 * Frame 13's clinical line: "RCT 36 · obturation today".
 *
 * Built here rather than inline because the fallbacks matter clinically. A visit with no
 * treatment plan — most walk-ins — must still say something true, and it must never
 * render a half-line like "RCT ·" when the tooth is missing. The allergy is NOT part of
 * this string: it is rendered separately in crit so line-clamping can never truncate it
 * away, which is the one part of the hero that must survive at any width.
 */
export function heroClinicalLine(visit: {
  activePlan?: {
    procedure: string;
    teeth: number[];
    sitting: number;
    totalSittings: number;
  } | null | undefined;
  chiefComplaint?: string | null;
}): string {
  const plan = visit.activePlan;
  if (!plan) return visit.chiefComplaint ?? 'Consultation';

  const teeth = plan.teeth.length ? ` ${plan.teeth.join(', ')}` : '';
  const sitting =
    plan.totalSittings > 1
      ? ` · sitting ${plan.sitting} of ${plan.totalSittings}`
      : '';
  return `${plan.procedure}${teeth}${sitting}`;
}
