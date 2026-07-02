import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Regression (Phase 9.5 P1.5, Issue 3): the Take Payment sheet showed "Due: —" and Amount 0 —
 * no bill existed and the doctor's dictated cost never reached the receptionist. The sheet must
 * ensure the visit's bill on open (idempotent POST /visits/:id/bill), render its line items, and
 * seed the amount from the bill's balance.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sheet = readFileSync(join(webRoot, 'components', 'queue', 'checkout-sheet.tsx'), 'utf8');

describe('Take Payment sheet — bill ensure + items + total', () => {
  it('ensures the visit bill when the sheet opens', () => {
    expect(sheet).toMatch(/useVisitBill\(visit\?\.id \?\? null, open\)/);
  });

  it('renders the bill line items with per-line amounts', () => {
    expect(sheet).toMatch(/bill\.items\.map/);
    expect(sheet).toMatch(/rupees\(item\.subtotalPaise\)/);
  });

  it('Due and the seeded amount come from the bill balance, not the possibly-null snapshot', () => {
    expect(sheet).toMatch(/bill\?\.balancePaise \?\? visit\.billDuePaise/);
    expect(sheet).toMatch(/defaultCheckoutForm\(bill\?\.balancePaise/);
  });
});
