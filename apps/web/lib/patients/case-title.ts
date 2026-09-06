/**
 * The name every surface uses for a treatment case — "RCT · Tooth 36".
 *
 * Frame 39 titles the case screen with this rather than "Treatment Plan": a doctor arriving
 * from a reference elsewhere in the app needs to see the same words they tapped, or they
 * stop to check they opened the right case.
 *
 * Lives here rather than in the page because a Next.js page may only export its own
 * reserved fields — and because the Cases tab and Overview card need the same string.
 */
export function caseTitle(
  planName: string,
  procName: string | undefined,
  teeth: number[],
): string {
  const base = planName.trim() || procName?.trim() || 'Case';
  // Plans are named freely: "RCT · Tooth 36" already carries its tooth, "Root canal" does
  // not. Appending unconditionally produced "RCT · Tooth 36 · Tooth 36" on the Overview
  // card — the same bug, one screen over.
  if (!teeth.length || /tooth/i.test(base)) return base;
  return `${base} · Tooth ${teeth.join(', ')}`;
}
