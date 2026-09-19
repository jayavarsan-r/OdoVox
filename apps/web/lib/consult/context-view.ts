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

/**
 * The recording chip's line: "C/O pain on chewing · lower left".
 *
 * It used to lead with the patient's first name, which frame 23 drops — the name is in
 * the strip directly above, and repeating it costs the chip a third of its width on a
 * 370px screen. "C/O" is what a dentist writes in the notes, so it reads as the label it
 * is. With no complaint on file the chip has nothing to say and the caller renders
 * nothing rather than a chip containing only a name.
 */
export function recordingStripText(ctx: ConsultationContext, max = 60): string {
  if (!hasComplaint(ctx)) return '';
  const complaint = ctx.visit.chiefComplaint!.trim();
  const clipped = complaint.length > max ? `${complaint.slice(0, max - 1).trimEnd()}…` : complaint;
  return `C/O ${clipped}`;
}

/** Gender to a compact label. */
export function genderLabel(gender: string): string {
  return gender === 'MALE' ? 'M' : gender === 'FEMALE' ? 'F' : gender === 'OTHER' ? 'O' : gender;
}

export function xrayCount(ctx: ConsultationContext): number {
  return ctx.xrays.length;
}
