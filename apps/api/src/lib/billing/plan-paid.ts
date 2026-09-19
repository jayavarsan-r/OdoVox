/**
 * How much has actually been paid against one treatment plan (frame 39's FEES tile).
 *
 * Derived from records that already exist — BillItem rows pointing at the plan's
 * Procedures — rather than stored, so there is no second billing source of truth to drift.
 *
 * The share matters. A bill can mix this plan's work with a consultation fee, consumables,
 * or another procedure entirely, and a patient may have paid only part of it. Crediting the
 * plan with the bill's whole `paidPaise` would report another procedure's payment as
 * progress on this one; crediting it with the item's full price would claim money nobody
 * has handed over. So each item earns its proportional share of what that bill collected.
 */
export interface PlanBillItem {
  subtotalPaise: number;
  bill: { totalPaise: number; paidPaise: number };
}

export function planPaidPaise(items: PlanBillItem[]): number {
  return items.reduce((sum, it) => {
    const total = it.bill.totalPaise;
    // A zero-total bill has no share to apportion; dividing by it would be a NaN in a
    // money figure, which is worse than showing nothing.
    if (total <= 0) return sum;
    return sum + Math.round((it.subtotalPaise / total) * it.bill.paidPaise);
  }, 0);
}
