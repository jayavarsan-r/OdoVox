/**
 * Doctor-home queue summary line. Derives from the same queue store /consult reads — never
 * hardcoded (Phase 9.5 Issue 2: Home claimed "Queue is clear" over a populated queue).
 */
export function consultHeroSubtitle(inChairName: string | null, waiting: number): string {
  if (inChairName) {
    return waiting > 0 ? `Now treating ${inChairName} · ${waiting} waiting` : `Now treating ${inChairName}`;
  }
  if (waiting > 0) return `${waiting} waiting`;
  return 'Queue is clear';
}
