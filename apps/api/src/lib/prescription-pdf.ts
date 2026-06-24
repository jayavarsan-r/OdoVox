import PDFDocument from 'pdfkit';
import type { Medicine } from '@odovox/types';

export interface PrescriptionPdfData {
  clinicName: string;
  clinicAddress: string;
  doctorName: string;
  qualification: string | null;
  registrationNumber: string | null;
  patientName: string;
  patientAge: number;
  patientGender: string;
  date: Date;
  medicines: Medicine[];
  instructions: string | null;
  reviewAfterDays: number | null;
}

/** Render a clinic-branded prescription PDF and resolve to a Buffer. */
export function generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // compress:false keeps the (small) content stream uncompressed so text is greppable.
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text(data.clinicName, { continued: false });
    doc.fontSize(10).fillColor('#555').text(data.clinicAddress);
    doc.moveDown(0.3);
    doc.fillColor('#000').fontSize(11).text(`Dr. ${data.doctorName}${data.qualification ? `, ${data.qualification}` : ''}`);
    if (data.registrationNumber) doc.fontSize(9).fillColor('#555').text(`Reg. No: ${data.registrationNumber}`);
    doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#ddd').stroke();
    doc.moveDown(1);

    // Patient + date
    doc.fillColor('#000').fontSize(11);
    doc.text(`Patient: ${data.patientName}`, { continued: true });
    doc.text(`    Age/Sex: ${data.patientAge} / ${data.patientGender}`, { align: 'left' });
    doc.text(`Date: ${data.date.toLocaleDateString('en-IN')}`);
    doc.moveDown(0.8);

    // Rx
    doc.fontSize(16).fillColor('#000').text('Rx', { underline: false });
    doc.moveDown(0.4);
    doc.fontSize(11);
    data.medicines.forEach((m, i) => {
      doc.font('Helvetica-Bold').text(`${i + 1}. ${m.name}`, { continued: false });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333')
        .text(
          `    ${m.dosage} · ${m.frequency} · ${m.durationDays} day(s)${m.instructions ? ` · ${m.instructions}` : ''}`,
        );
      doc.fillColor('#000').fontSize(11);
      doc.moveDown(0.3);
    });

    if (data.instructions) {
      doc.moveDown(0.5).font('Helvetica-Bold').fontSize(11).text('Instructions:');
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(data.instructions);
      doc.fillColor('#000');
    }
    if (data.reviewAfterDays != null) {
      doc.moveDown(0.5).fontSize(10).text(`Review after: ${data.reviewAfterDays} day(s)`);
    }

    // Footer signature
    doc.moveDown(3);
    doc.fontSize(10).text('_______________________', { align: 'right' });
    doc.text(`Dr. ${data.doctorName}`, { align: 'right' });
    if (data.registrationNumber) doc.fontSize(8).fillColor('#555').text(`Reg. No: ${data.registrationNumber}`, { align: 'right' });

    doc.end();
  });
}
