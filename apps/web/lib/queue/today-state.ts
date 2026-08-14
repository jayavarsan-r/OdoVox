import type { VisitStatus } from "@odovox/types";

/**
 * Reception's view of a patient's journey, and of the day as a whole.
 *
 * `/today` is not a visual migration — it is where the front desk spends most of its
 * shift. The nine states below are the ones reception actually acts on, and each is a
 * different decision: call someone in, chase a no-show, take a payment, close the day.
 * Getting one wrong sends the wrong person into a chair.
 *
 * So the mapping lives here, tested, rather than as status checks scattered through JSX.
 */

export type ReceptionRowState =
  /** Booked, not here yet — reception may need to call and confirm. */
  | "booked"
  /** Checked in at the desk; not yet in the waiting queue. */
  | "arrived"
  /** In the queue, waiting to be called. */
  | "waiting"
  /** With the doctor now. */
  | "in-chair"
  /** Treatment done, money outstanding — reception's next action. */
  | "checkout"
  /** Finished and paid. Nothing left to do. */
  | "completed"
  /** Booked, never arrived. */
  | "no-show"
  /** Cancelled — kept visible so the slot is understood as freed, not forgotten. */
  | "cancelled";

/**
 * A walk-in is not a status — it is an ORIGIN. A walk-in can be waiting, in the chair or
 * checked out just like a booked patient, so it rides alongside the row state rather than
 * replacing it. Modelling it as a ninth status was the tempting mistake: it would have
 * made "walk-in" and "in chair" mutually exclusive, which they are not.
 */
export function isWalkIn(appointmentId: string | null | undefined): boolean {
  return !appointmentId;
}

export function receptionRowState(status: VisitStatus): ReceptionRowState {
  switch (status) {
    case "SCHEDULED":
      return "booked";
    case "CHECKED_IN":
      return "arrived";
    case "WAITING":
      return "waiting";
    case "IN_CHAIR":
      return "in-chair";
    case "CHECKOUT":
      return "checkout";
    case "COMPLETED":
      return "completed";
    case "NO_SHOW":
      return "no-show";
    case "CANCELLED":
      return "cancelled";
  }
}

/** Which rows reception can still act on. Drives ordering and the "needs you" grouping. */
export function needsAttention(state: ReceptionRowState): boolean {
  return (
    state === "arrived" ||
    state === "waiting" ||
    state === "checkout" ||
    state === "no-show"
  );
}

export type ReceptionDayState =
  /** Nothing booked and nobody here. */
  | "empty-day"
  /** Everyone booked is finished, and nobody is left in the building. */
  | "day-done"
  /** Normal running day. */
  | "active";

export interface DayInput {
  /** Every visit today, whatever its status. */
  total: number;
  /** Visits that reached COMPLETED. */
  completed: number;
  /** Anyone booked, arrived, waiting, in a chair or awaiting checkout. */
  openRows: number;
}

/**
 * Precedence, and why:
 *
 *  1. ACTIVE whenever any row is still open — a single person waiting outranks a
 *     finished-looking day. Telling reception "that's everyone" while someone sits in
 *     the waiting room is the failure mode that matters here.
 *  2. EMPTY-DAY before day-done, so a clinic with nothing booked is not congratulated.
 *  3. DAY-DONE only when everything booked resolved AND nobody is left.
 */
export function receptionDayState(input: DayInput): ReceptionDayState {
  const total = Math.max(0, Math.floor(input.total));
  const openRows = Math.max(0, Math.floor(input.openRows));

  if (openRows > 0) return "active";
  if (total === 0) return "empty-day";
  return "day-done";
}

/**
 * The money still to collect at checkout — frame 50's PENDING tile.
 *
 * The tile rendered `checkout.length`, a COUNT, in a tile styled identically to COLLECTED
 * beside it, which renders money. "COLLECTED ₹0 · PENDING 1" reads as one rupee pending,
 * and a receptionist balancing a drawer is exactly the person who will read it that way.
 *
 * Visits whose bill has not been raised yet contribute nothing rather than being guessed
 * at: an un-billed checkout is an unknown amount, not a zero one, and the count beside the
 * section header already says how many people are waiting.
 */
export function pendingCheckoutPaise(visits: { billDuePaise: number | null }[]): number {
  return visits.reduce((sum, v) => sum + Math.max(0, v.billDuePaise ?? 0), 0);
}

/**
 * Frame 50's free-chair footer: "DR. ARJUN · CHAIR 2 — FREE, NEXT 11:15".
 *
 * Ruled in on #74 because it is real operational state, not decoration — it is what a
 * receptionist reads before deciding where to put a walk-in. Built from the rooms the
 * queue snapshot already carries plus the next booked start, so nothing is invented.
 *
 * Room NAMES come straight from the data (#70): the model says "Room 1" and that is what
 * shows. Calling it a chair in the UI while the schema calls it a room would invent
 * operational semantics the rest of the system does not share.
 */
export interface FreeRoomLine {
  roomName: string;
  /** Local time the next appointment fills it, or null when the rest of the day is clear. */
  nextAt: string | null;
}

export function freeRooms(
  rooms: { id: string; name: string; status: string }[],
  occupiedRoomIds: (string | null)[],
  nextStartByRoom: Record<string, string | null> = {},
): FreeRoomLine[] {
  const busy = new Set(occupiedRoomIds.filter((r): r is string => !!r));
  return rooms
    // OFFLINE rooms are not free — they are out of service, and offering one to a walk-in
    // sends the patient to a chair nobody can use.
    .filter((r) => r.status !== 'OFFLINE' && !busy.has(r.id))
    .map((r) => ({ roomName: r.name, nextAt: nextStartByRoom[r.id] ?? null }));
}
