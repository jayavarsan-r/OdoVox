import type { ConsultationContext } from '@odovox/types';

/**
 * Pure view-model for the consultation patient-context card (Phase 4.5). Keeps the chief-complaint
 * fallback + the recording-strip summary out of the component so they're unit-testable.
 */
export const NO_COMPLAINT = 'No complaint recorded';

/** The chief complaint to display, or the muted fallback. */
export function complaintText(ctx: ConsultationContext): string {
  return ctx.visit.chiefComplaint?.trim() || NO_COMPLAINT;
}

export function hasComplaint(ctx: ConsultationContext): boolean {
  return !!ctx.visit.chiefComplaint?.trim();
}

/** A single-line summary for the compact recording strip: "Akhilesh · "Tooth pain upper left"". */
export function recordingStripText(ctx: ConsultationContext, max = 60): string {
  const first = ctx.patient.name.split(/\s+/)[0] ?? ctx.patient.name;
  if (!hasComplaint(ctx)) return first;
  const complaint = ctx.visit.chiefComplaint!.trim();
  const clipped = complaint.length > max ? `${complaint.slice(0, max - 1).trimEnd()}…` : complaint;
  return `${first} · "${clipped}"`;
}

/** Gender to a compact label. */
export function genderLabel(gender: string): string {
  return gender === 'MALE' ? 'M' : gender === 'FEMALE' ? 'F' : gender === 'OTHER' ? 'O' : gender;
}

export function xrayCount(ctx: ConsultationContext): number {
  return ctx.xrays.length;
}
