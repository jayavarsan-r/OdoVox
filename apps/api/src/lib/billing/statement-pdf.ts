import PDFDocument from 'pdfkit';

export interface StatementLine {
  date: Date;
  ref: string;
  description: string;
  /** Signed paise: bills/charges positive, payments/refunds as shown. */
  debitPaise: number;
  creditPaise: number;
}

export interface PatientStatementData {
  clinicName: string;
  clinicAddress: string;
  patientName: string;
  patientPhone: string;
  fromDate: Date;
  toDate: Date;
  lines: StatementLine[];
  totalBilledPaise: number;
  totalPaidPaise: number;
  totalRefundedPaise: number;
  outstandingPaise: number;
}

const rupees = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Render a patient account statement PDF for a date range and resolve to a Buffer. */
export function generatePatientStatementPdf(data: PatientStatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#000').text(data.clinicName);
    doc.fontSize(10).fillColor('#555').text(data.clinicAddress);
    doc.moveDown(0.4);
    doc.fillColor('#000').fontSize(14).text('ACCOUNT STATEMENT', { align: 'right' });
    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`${data.fromDate.toLocaleDateString('en-IN')} – ${data.toDate.toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#ddd').stroke();
    doc.moveDown(0.8);

    doc.fillColor('#000').fontSize(11).text(`Patient: ${data.patientName}`);
    doc.fontSize(10).fillColor('#555').text(`Phone: ${data.patientPhone}`);
    doc.moveDown(0.6);

    const cols = { date: 50, desc: 130, debit: 380, credit: 470 };
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
    const hY = doc.y;
    doc.text('Date', cols.date, hY);
    doc.text('Detail', cols.desc, hY);
    doc.text('Charge', cols.debit, hY);
    doc.text('Paid', cols.credit, hY);
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ddd').stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica').fontSize(9);
    for (const line of data.lines) {
      const y = doc.y;
      doc.fillColor('#000').text(line.date.toLocaleDateString('en-IN'), cols.date, y);
      doc.text(`${line.ref} · ${line.description}`, cols.desc, y, { width: 240 });
      doc.text(line.debitPaise ? rupees(line.debitPaise) : '', cols.debit, y);
      doc.text(line.creditPaise ? rupees(line.creditPaise) : '', cols.credit, y);
      doc.moveDown(0.4);
    }
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ddd').stroke();
    doc.moveDown(0.6);

    const totalLine = (label: string, value: string, bold = false): void => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#000');
      doc.text(label, 330, doc.y, { continued: true, width: 130 });
      doc.text(value, { align: 'right' });
    };
    totalLine('Total billed', rupees(data.totalBilledPaise));
    totalLine('Total paid', rupees(data.totalPaidPaise));
    if (data.totalRefundedPaise > 0) totalLine('Total refunded', rupees(data.totalRefundedPaise));
    totalLine('Outstanding', rupees(data.outstandingPaise), true);

    doc.moveDown(1).font('Helvetica').fontSize(9).fillColor('#888').text('This is a computer-generated statement.', 50);
    doc.end();
  });
}
