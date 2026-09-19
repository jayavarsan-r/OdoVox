import type { PaymentMethod, PaymentStatus } from "@odovox/db";

/**
 * The two facts frame 41 puts on a bill row beyond its amount: WHAT it was for, and WHEN
 * and HOW it was paid. Both are derived from authoritative records — BillItem.description
 * and Payment — never invented. Where the data cannot answer, the answer is null and the
 * row simply says less.
 *
 * Investigated before writing (owner ruling): BillItem carries an authoritative
 * `description` plus sourceType/sourceId to the Procedure; Payment carries `method`,
 * `receivedAt`, a status enum including REFUNDED/PARTIAL_REFUND/CANCELLED/FAILED, and
 * `refundedAmountPaise`. Nothing new is stored — this is a read model over what exists.
 */

/** Payment states that represent money actually received and kept. */
const COUNTED: PaymentStatus[] = ["SUCCEEDED", "PARTIAL_REFUND"];

export interface BillItemLike {
  description: string;
  subtotalPaise: number;
}

export interface PaymentLike {
  method: PaymentMethod;
  status: PaymentStatus;
  receivedAt: Date | null;
  createdAt: Date;
}

/**
 * What the bill was for.
 *
 * One item → its own description. Several → the LARGEST by value, which is the procedure
 * the bill is actually about, plus a count of the rest. Picking "the first" would be
 * arbitrary ordering dressed up as a summary; picking the biggest is a stated rule that
 * survives a reordered query.
 *
 * Never concatenates every line: a four-item bill would produce a string no row can hold,
 * and the full breakdown already lives one tap away in the bill itself.
 */
export function billDescription(items: BillItemLike[]): string | null {
  const named = items.filter((i) => i.description.trim().length > 0);
  if (named.length === 0) return null;

  const main = named.reduce((a, b) =>
    b.subtotalPaise > a.subtotalPaise ? b : a,
  );
  const rest = named.length - 1;
  return rest > 0
    ? `${main.description.trim()} +${rest} more`
    : main.description.trim();
}

export interface PaymentContext {
  /** When money last arrived. Null while nothing has been received. */
  lastAt: Date | null;
  /** The method, when every counted payment used the same one. Null if none, or mixed. */
  method: PaymentMethod | null;
  /** True when counted payments used more than one method — the row must not pick one. */
  mixed: boolean;
}

/**
 * How and when the bill was paid.
 *
 * The ruling was explicit that "latest payment" must not be assumed correct for multiple
 * payments, so it is not assumed here:
 *
 *  - the DATE is the most recent counted payment, because the question a row answers is
 *    "when did money last arrive", which is well defined however many payments there are;
 *  - the METHOD is reported ONLY when every counted payment used the same one. A bill
 *    settled half in cash and half by UPI has no single method, and printing the latest
 *    would tell a receptionist reconciling a drawer something false. `mixed` says so
 *    instead.
 *
 * FAILED and CANCELLED payments are ignored entirely — no money moved. A fully REFUNDED
 * payment is likewise not money the clinic holds. PARTIAL_REFUND counts, because some of
 * it was kept and the bill's paidPaise still reflects it.
 *
 * `receivedAt` is the authoritative moment; a counted payment without one falls back to
 * `createdAt` rather than dropping out of the ordering.
 */
export function paymentContext(payments: PaymentLike[]): PaymentContext {
  const counted = payments.filter((p) => COUNTED.includes(p.status));
  if (counted.length === 0) return { lastAt: null, method: null, mixed: false };

  const at = (p: PaymentLike) => p.receivedAt ?? p.createdAt;
  const lastAt = counted.reduce((a, b) => (at(b) > at(a) ? b : a));
  const methods = new Set(counted.map((p) => p.method));

  return {
    lastAt: at(lastAt),
    method: methods.size === 1 ? [...methods][0]! : null,
    mixed: methods.size > 1,
  };
}
