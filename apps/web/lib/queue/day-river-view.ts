import type { AppointmentStatus } from "@odovox/types";
import { rupees } from "../billing/format";

/**
 * Frame 13's day river and the caption under it.
 *
 * "8 segments, one per appointment: lime = done, dark = in the chair now, hollow = ahead.
 *  One glance = where am I in my day; filling it is the daily loop."
 *
 * The caption is the arithmetic the river deliberately does not draw: "3 seen · Anand in
 * the chair · 4 to go · ₹7,950 in". It replaced Home's stat pills — a doctor mid-clinic
 * wants shape from the bar and numbers from one line, not four tiles of figures.
 */

export interface DayShape {
  total: number;
  done: number;
  /** Zero-based index of the patient in the chair, or null when the chair is free. */
  currentIndex: number | null;
}

export interface DayAppointment {
  status: AppointmentStatus;
  patientId?: string | null;
}

/**
 * Cancelled and no-show appointments leave the day: a cancelled slot is not work still to
 * do, and drawing it as "ahead" would tell a doctor with an empty afternoon they have
 * three patients left.
 */
export function dayShape(
  appointments: DayAppointment[],
  inChairPatientId: string | null,
): DayShape {
  const live = appointments.filter(
    (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW",
  );
  const idx = inChairPatientId
    ? live.findIndex((a) => a.patientId === inChairPatientId)
    : -1;

  return {
    total: live.length,
    done: live.filter((a) => a.status === "COMPLETED").length,
    currentIndex: idx >= 0 ? idx : null,
  };
}

/**
 * The caption line. Each clause is dropped when it has nothing to say rather than shown as
 * a zero — "0 to go" reads as a fact about the day when it actually means the day is over,
 * and "₹0 in" on a morning with no billing yet reads as a bad day rather than an early one.
 */
export function dayCaption(
  shape: DayShape,
  inChairName: string | null,
  collectedPaise: number | null,
): { text: string; chairName: string | null } {
  const remaining = Math.max(
    0,
    shape.total - shape.done - (shape.currentIndex != null ? 1 : 0),
  );
  const parts: string[] = [];

  if (shape.done > 0) parts.push(`${shape.done} seen`);
  if (inChairName) parts.push(`${inChairName} in the chair`);
  if (remaining > 0) parts.push(`${remaining} to go`);
  if (collectedPaise != null && collectedPaise > 0)
    parts.push(`${rupees(collectedPaise)} in`);

  return { text: parts.join(" · "), chairName: inChairName };
}
