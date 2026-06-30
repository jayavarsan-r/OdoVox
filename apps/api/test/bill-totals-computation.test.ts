import { describe, expect, it } from 'vitest';
import { computeBillTotals, computeLineSubtotal, splitGst } from '../src/lib/billing/totals.js';

describe('Bill totals computation', () => {
  it('aggregates line items with line- and bill-level discounts (GST-exempt)', () => {
    const t = computeBillTotals({
      items: [
        { quantity: 1, unitPricePaise: 900000 }, // RCT ₹9,000
        { quantity: 2, unitPricePaise: 50000, discountPaise: 20000 }, // 2× ₹500 − ₹200 line discount = ₹800
      ],
      discountPaise: 100000, // ₹1,000 bill discount
      gstApplicable: false,
      gstPercent: 0,
    });
    expect(computeLineSubtotal({ quantity: 2, unitPricePaise: 50000, discountPaise: 20000 })).toBe(80000);
    expect(t.subtotalPaise).toBe(980000); // 900000 + 80000
    expect(t.discountPaise).toBe(100000);
    expect(t.gstPaise).toBe(0); // exempt
    expect(t.totalPaise).toBe(880000); // 980000 - 100000
  });

  it('adds 18% GST on the taxable base when the clinic is GST-registered, split 9/9 CGST/SGST', () => {
    const t = computeBillTotals({
      items: [{ quantity: 1, unitPricePaise: 1000000 }], // ₹10,000
      discountPaise: 0,
      gstApplicable: true,
      gstPercent: 18,
    });
    expect(t.subtotalPaise).toBe(1000000);
    expect(t.gstPaise).toBe(180000); // 18% of 10,000 = ₹1,800
    expect(t.totalPaise).toBe(1180000);
    const { cgstPaise, sgstPaise } = splitGst(t.gstPaise);
    expect(cgstPaise).toBe(90000);
    expect(sgstPaise).toBe(90000);
    expect(cgstPaise + sgstPaise).toBe(t.gstPaise);
  });

  it('floors negative lines at 0, caps bill discount at subtotal, and gives CGST the odd paise', () => {
    const t = computeBillTotals({
      items: [{ quantity: 1, unitPricePaise: 30000, discountPaise: 99999 }], // discount > price → 0
      discountPaise: 500000, // exceeds subtotal → capped
      gstApplicable: true,
      gstPercent: 18,
    });
    expect(t.subtotalPaise).toBe(0);
    expect(t.discountPaise).toBe(0); // capped at subtotal (0)
    expect(t.totalPaise).toBe(0);
    // odd-paise split: GST of 333 → 167 CGST + 166 SGST
    expect(splitGst(333)).toEqual({ cgstPaise: 167, sgstPaise: 166 });
  });
});
