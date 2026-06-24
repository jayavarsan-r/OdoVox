import { describe, expect, it } from 'vitest';
import { generatePrescriptionPdf } from '../src/lib/prescription-pdf.js';

describe('generatePrescriptionPdf', () => {
  const base = {
    clinicName: 'Smile Dental Care',
    clinicAddress: '12 MG Road, Bengaluru',
    doctorName: 'Asha Menon',
    qualification: 'BDS, MDS',
    registrationNumber: 'KA-DENT-12345',
    patientName: 'Meera Nair',
    patientAge: 34,
    patientGender: 'FEMALE',
    date: new Date('2026-06-23'),
    medicines: [
      { name: 'Amoxicillin 500mg', dosage: '1 tab', frequency: 'TID', durationDays: 5 },
    ],
    instructions: 'After food',
    reviewAfterDays: 7,
  };

  it('produces a non-trivial PDF buffer with the %PDF header', async () => {
    const buf = await generatePrescriptionPdf(base);
    expect(buf.length).toBeGreaterThan(800);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('produces a structurally valid, multi-object PDF that grows with more content', async () => {
    const buf = await generatePrescriptionPdf(base);
    const text = buf.toString('latin1');
    // pdfkit encodes text per-glyph so the literal name isn't greppable; assert structure.
    expect(text).toContain('/Type');
    expect(text).toMatch(/\/Page\b/);
    expect(text).toContain('%%EOF');

    // More medicines + instructions ⇒ a larger document (proves content is rendered).
    const bigger = await generatePrescriptionPdf({
      ...base,
      medicines: Array.from({ length: 8 }, (_, i) => ({
        name: `Medicine ${i}`,
        dosage: '1 tab',
        frequency: 'BD',
        durationDays: 5,
        instructions: 'after food',
      })),
    });
    expect(bigger.length).toBeGreaterThan(buf.length);
  });
});
