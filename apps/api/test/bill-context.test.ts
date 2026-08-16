import { describe, expect, it } from "vitest";
import {
  billDescription,
  paymentContext,
  type PaymentLike,
} from "../src/lib/billing/bill-context.js";

/**
 * Frame 41 puts "what was this for" and "when/how was it paid" on each bill row. Both are
 * derived from authoritative records; the point of these tests is that every case the
 * ruling enumerated produces either a true answer or none — never a plausible-looking
 * guess.
 */
const pay = (over: Partial<PaymentLike>): PaymentLike => ({
  method: "CASH",
  status: "SUCCEEDED",
  receivedAt: new Date("2026-06-28T10:00:00Z"),
  createdAt: new Date("2026-06-28T09:00:00Z"),
  ...over,
});

describe("billDescription", () => {
  it("uses the single item verbatim", () => {
    expect(
      billDescription([
        { description: "RCT sitting 2", subtotalPaise: 300_000 },
      ]),
    ).toBe("RCT sitting 2");
  });

  it("leads with the largest line, not whichever the query returned first", () => {
    // "First" is ordering dressed up as a summary and changes when the query changes.
    expect(
      billDescription([
        { description: "Consumables", subtotalPaise: 20_000 },
        { description: "Crown · 14", subtotalPaise: 450_000 },
      ]),
    ).toBe("Crown · 14 +1 more");
  });

  it("never concatenates a bill into a string no row can hold", () => {
    const out = billDescription([
      { description: "RCT sitting 2", subtotalPaise: 300_000 },
      { description: "X-ray", subtotalPaise: 20_000 },
      { description: "Consumables", subtotalPaise: 10_000 },
    ]);
    expect(out).toBe("RCT sitting 2 +2 more");
  });

  it("is null when there is nothing authoritative to say", () => {
    expect(billDescription([])).toBeNull();
    expect(
      billDescription([{ description: "   ", subtotalPaise: 100 }]),
    ).toBeNull();
  });
});

describe("paymentContext", () => {
  it("an UNPAID bill reports nothing rather than a zero date", () => {
    expect(paymentContext([])).toEqual({
      lastAt: null,
      method: null,
      mixed: false,
    });
  });

  it("a fully paid bill reports its method and date", () => {
    const ctx = paymentContext([pay({ method: "UPI" })]);
    expect(ctx.method).toBe("UPI");
    expect(ctx.mixed).toBe(false);
    expect(ctx.lastAt).toEqual(new Date("2026-06-28T10:00:00Z"));
  });

  it("a partially paid bill still reports the payment that did arrive", () => {
    // Partial is a bill-level fact (balancePaise); the payment that happened is real.
    const ctx = paymentContext([pay({ method: "CASH" })]);
    expect(ctx.method).toBe("CASH");
  });

  it("MULTIPLE payments in one method report that method and the latest date", () => {
    const ctx = paymentContext([
      pay({ method: "CASH", receivedAt: new Date("2026-06-20T10:00:00Z") }),
      pay({ method: "CASH", receivedAt: new Date("2026-06-28T10:00:00Z") }),
    ]);
    expect(ctx.method).toBe("CASH");
    expect(ctx.lastAt).toEqual(new Date("2026-06-28T10:00:00Z"));
  });

  it("MIXED methods report no method at all", () => {
    // The ruling forbade assuming the latest payment represents the bill. Half in cash and
    // half by UPI has no single method, and printing one would mislead a receptionist
    // reconciling a drawer.
    const ctx = paymentContext([
      pay({ method: "CASH" }),
      pay({ method: "UPI" }),
    ]);
    expect(ctx.method).toBeNull();
    expect(ctx.mixed).toBe(true);
    expect(ctx.lastAt).not.toBeNull();
  });

  it("ignores FAILED and CANCELLED payments — no money moved", () => {
    expect(
      paymentContext([pay({ status: "FAILED" }), pay({ status: "CANCELLED" })]),
    ).toEqual({
      lastAt: null,
      method: null,
      mixed: false,
    });
  });

  it("ignores a fully REFUNDED payment, keeps a PARTIAL_REFUND", () => {
    expect(paymentContext([pay({ status: "REFUNDED" })]).method).toBeNull();
    // Some of it was kept, and the bill's paidPaise still reflects it.
    expect(
      paymentContext([pay({ status: "PARTIAL_REFUND", method: "CARD" })])
        .method,
    ).toBe("CARD");
  });

  it("a refunded payment does not make a real one look mixed", () => {
    const ctx = paymentContext([
      pay({ method: "UPI", status: "REFUNDED" }),
      pay({ method: "CASH", status: "SUCCEEDED" }),
    ]);
    expect(ctx.method).toBe("CASH");
    expect(ctx.mixed).toBe(false);
  });

  it("falls back to createdAt when receivedAt was never stamped", () => {
    const ctx = paymentContext([pay({ receivedAt: null })]);
    expect(ctx.lastAt).toEqual(new Date("2026-06-28T09:00:00Z"));
  });
});
