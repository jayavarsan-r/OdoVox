import PDFDocument from 'pdfkit';
import { splitGst } from './totals.js';

export interface BillPdfItem {
  description: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  subtotalPaise: number;
}

export interface BillPdfData {
  clinicName: string;
  clinicAddress: string;
  gstNumber: string | null;
  billNumber: string;
  date: Date;
  patientName: string;
  patientPhone: string;
  items: BillPdfItem[];
  subtotalPaise: number;
  discountPaise: number;
  gstApplicable: boolean;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: string;
}

const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Render a clinic-branded invoice PDF and resolve to a Buffer. Mirrors generatePrescriptionPdf. */
export function generateBillPdf(data: BillPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#000').text(data.clinicName);
    doc.fontSize(10).fillColor('#555').text(data.clinicAddress);
    if (data.gstNumber) doc.fontSize(9).text(`GSTIN: ${data.gstNumber}`);
    doc.moveDown(0.4);
    doc.fillColor('#000').fontSize(14).text('INVOICE', { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(`Bill No: ${data.billNumber}`, { align: 'right' });
    doc.text(`Date: ${data.date.toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#ddd').stroke();
    doc.moveDown(1);

    // Patient
    doc.fillColor('#000').fontSize(11).text(`Patient: ${data.patientName}`);
    doc.fontSize(10).fillColor('#555').text(`Phone: ${data.patientPhone}`);
    doc.moveDown(0.8);

    // Items table header
    const cols = { desc: 50, qty: 330, rate: 380, amount: 470 };
    doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
    doc.text('Description', cols.desc, doc.y, { continued: false });
    const headerY = doc.y - 12;
    doc.text('Qty', cols.qty, headerY);
    doc.text('Rate', cols.rate, headerY);
    doc.text('Amount', cols.amount, headerY);
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    // Items
    doc.font('Helvetica').fontSize(10);
    for (const item of data.items) {
      const rowY = doc.y;
      doc.fillColor('#000').text(item.description, cols.desc, rowY, { width: 270 });
      const lineY = rowY;
      doc.text(String(item.quantity), cols.qty, lineY);
      doc.text(rupees(item.unitPricePaise), cols.rate, lineY);
      doc.text(rupees(item.subtotalPaise), cols.amount, lineY);
      doc.moveDown(0.4);
    }
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ddd').stroke();
    doc.moveDown(0.6);

    // Totals
    const totalLine = (label: string, value: string, bold = false): void => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#000');
      doc.text(label, 330, doc.y, { continued: true, width: 130 });
      doc.text(value, { align: 'right' });
    };
    totalLine('Subtotal', rupees(data.subtotalPaise));
    if (data.discountPaise > 0) totalLine('Discount', `- ${rupees(data.discountPaise)}`);
    if (data.gstApplicable) {
      const { cgstPaise, sgstPaise } = splitGst(data.gstPaise);
      const half = data.gstPercent / 2;
      totalLine(`CGST @ ${half}%`, rupees(cgstPaise));
      totalLine(`SGST @ ${half}%`, rupees(sgstPaise));
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#888').text('GST not applicable', 330, doc.y, { align: 'right' });
    }
    doc.moveDown(0.2);
    totalLine('Total', rupees(data.totalPaise), true);
    doc.moveDown(0.3);
    totalLine('Paid', rupees(data.paidPaise));
    totalLine('Balance due', rupees(data.balancePaise), true);

    doc.moveDown(1.2);
    doc.font('Helvetica').fontSize(9).fillColor('#888').text(`Status: ${data.status}`, 50);
    doc.text('This is a computer-generated invoice.', 50);

    doc.end();
  });
}
