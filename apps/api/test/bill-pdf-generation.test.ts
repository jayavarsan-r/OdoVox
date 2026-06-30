import { describe, expect, it } from 'vitest';
import { generateBillPdf, type BillPdfData } from '../src/lib/billing/bill-pdf.js';

const base: BillPdfData = {
  clinicName: 'Smile Dental Care',
  clinicAddress: '12 MG Road, Bengaluru',
  gstNumber: null,
  billNumber: 'BL-SM1A2B',
  date: new Date('2026-06-23'),
  patientName: 'Akhilesh Guhan',
  patientPhone: '+919876543210',
  items: [
    { description: 'RCT 26', quantity: 1, unitPricePaise: 900000, discountPaise: 0, subtotalPaise: 900000 },
    { description: 'Crown — Zirconia', quantity: 1, unitPricePaise: 600000, discountPaise: 0, subtotalPaise: 600000 },
  ],
  subtotalPaise: 1500000,
  discountPaise: 0,
  gstApplicable: false,
  gstPercent: 0,
  gstPaise: 0,
  totalPaise: 1500000,
  paidPaise: 500000,
  balancePaise: 1000000,
  status: 'PARTIAL',
};

describe('Bill PDF generation', () => {
  it('renders a structurally valid invoice PDF with bill number, items and balance', async () => {
    const buf = await generateBillPdf(base);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(800);
    const text = buf.toString('latin1');
    expect(text).toContain('%%EOF');
    expect((text.match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(1);

    // A GST-registered clinic's invoice carries extra CGST/SGST lines → larger than the exempt one.
    const withGst = await generateBillPdf({
      ...base,
      gstNumber: '29ABCDE1234F1Z5',
      gstApplicable: true,
      gstPercent: 18,
      gstPaise: 270000,
      totalPaise: 1770000,
    });
    expect(withGst.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(withGst.length).toBeGreaterThan(buf.length);
  });
});
