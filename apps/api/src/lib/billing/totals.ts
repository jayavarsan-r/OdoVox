/**
 * Bill arithmetic — pure, server-side, the single source of truth for money on a Bill. The client
 * never sends totals; routes recompute these on every item mutation and at finalize. All values are
 * paise (Int). See docs/billing.md.
 *
 * Order of operations: line subtotal = (unit × qty) − line discount; bill subtotal = Σ line
 * subtotals; taxable = subtotal − bill-level discount; GST = taxable × gstPercent (only when the
 * clinic is GST-registered); total = taxable + GST.
 */

export interface BillLineInput {
  quantity: number;
  unitPricePaise: number;
  discountPaise?: number;
}

export interface BillTotalsInput {
  items: BillLineInput[];
  discountPaise?: number;
  gstApplicable: boolean;
  gstPercent: number;
}

export interface BillTotals {
  subtotalPaise: number;
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
}

/** Line subtotal: (unit × qty) − line discount, floored at 0. */
export function computeLineSubtotal(line: BillLineInput): number {
  const gross = line.unitPricePaise * line.quantity;
  return Math.max(0, gross - (line.discountPaise ?? 0));
}

export function computeBillTotals(input: BillTotalsInput): BillTotals {
  const subtotalPaise = input.items.reduce((s, l) => s + computeLineSubtotal(l), 0);
  // Bill-level discount can't exceed the subtotal.
  const discountPaise = Math.min(subtotalPaise, Math.max(0, input.discountPaise ?? 0));
  const taxable = subtotalPaise - discountPaise;
  const gstPaise = input.gstApplicable ? Math.round((taxable * input.gstPercent) / 100) : 0;
  return { subtotalPaise, discountPaise, gstPaise, totalPaise: taxable + gstPaise };
}

/**
 * Intra-state dental GST is 18% = 9% CGST + 9% SGST. Split the computed GST into the two halves so
 * the invoice PDF can show the statutory breakup; CGST takes any odd paise so the halves still sum
 * exactly to gstPaise.
 */
export function splitGst(gstPaise: number): { cgstPaise: number; sgstPaise: number } {
  const sgstPaise = Math.floor(gstPaise / 2);
  return { cgstPaise: gstPaise - sgstPaise, sgstPaise };
}
