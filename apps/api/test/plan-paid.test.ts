import { describe, expect, it } from 'vitest';
import { planPaidPaise, type PlanBillItem } from '../src/lib/billing/plan-paid.js';

const item = (subtotal: number, total: number, paid: number): PlanBillItem => ({
  subtotalPaise: subtotal,
  bill: { totalPaise: total, paidPaise: paid },
});

/**
 * Frame 39's FEES tile reports progress against a treatment plan in money. Getting it
 * wrong in either direction misleads: over-report and the clinic thinks it has been paid
 * for work it hasn't; under-report and a receptionist chases a patient who is square.
 */
describe('planPaidPaise', () => {
  it('a fully paid bill for only this plan credits the whole amount', () => {
    expect(planPaidPaise([item(300_000, 300_000, 300_000)])).toBe(300_000);
  });

  it('an unpaid bill credits nothing, even though the work is on it', () => {
    // A raised bill is not revenue. The tile must not count a draft as paid.
    expect(planPaidPaise([item(300_000, 300_000, 0)])).toBe(0);
  });

  it('a part-paid bill credits only the part that arrived', () => {
    expect(planPaidPaise([item(300_000, 300_000, 150_000)])).toBe(150_000);
  });

  it('a mixed bill credits this plan only its share', () => {
    // ₹3,000 of plan work on a ₹5,000 bill that is half paid → ₹1,500, not ₹2,500 (the
    // bill's whole payment) and not ₹3,000 (the item's full price).
    expect(planPaidPaise([item(300_000, 500_000, 250_000)])).toBe(150_000);
  });

  it('sums across several bills', () => {
    expect(planPaidPaise([item(200_000, 200_000, 200_000), item(100_000, 100_000, 50_000)])).toBe(
      250_000,
    );
  });

  it('never produces NaN from a zero-total bill', () => {
    // A NaN rendered into a money figure is worse than showing nothing.
    expect(planPaidPaise([item(100_000, 0, 0)])).toBe(0);
  });

  it('is zero when the plan has no billed items', () => {
    expect(planPaidPaise([])).toBe(0);
  });
});
