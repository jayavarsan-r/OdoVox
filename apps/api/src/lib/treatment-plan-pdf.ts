import PDFDocument from 'pdfkit';

export interface PlanPdfSitting {
  sittingNumber: number;
  date: Date | null;
  notes: string | null;
  completed: boolean;
}

export interface PlanPdfProcedure {
  name: string;
  toothNumbers: number[];
  totalSittings: number;
  completedSittings: number;
  status: string;
  sittings: PlanPdfSitting[];
}

export interface PlanPdfPrescription {
  date: Date;
  medicines: { name: string; dosage?: string; frequency?: string; durationDays?: number | null }[];
}

export interface TreatmentPlanPdfData {
  clinicName: string;
  clinicAddress: string;
  doctorName: string;
  qualification: string | null;
  registrationNumber: string | null;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientCode: string;
  planName: string;
  status: string;
  estimatedCostPaise: number;
  createdAt: Date;
  procedures: PlanPdfProcedure[];
  prescriptions: PlanPdfPrescription[];
  xrayCount: number;
}

const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN')}`;
const day = (d: Date | null): string => (d ? d.toLocaleDateString('en-IN') : '—');

/** Render a multi-page treatment-plan case sheet and resolve to a Buffer. */
export function generateTreatmentPlanPdf(data: TreatmentPlanPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const rule = () => {
      doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#ddd').stroke();
      doc.moveDown(1);
    };

    // ── Page 1: letterhead + identity + overview ────────────────────────────
    doc.fontSize(20).fillColor('#000').text(data.clinicName);
    doc.fontSize(10).fillColor('#555').text(data.clinicAddress);
    doc.moveDown(0.3);
    doc.fillColor('#000').fontSize(11).text(`Dr. ${data.doctorName}${data.qualification ? `, ${data.qualification}` : ''}`);
    if (data.registrationNumber) doc.fontSize(9).fillColor('#555').text(`Reg. No: ${data.registrationNumber}`);
    rule();

    doc.fillColor('#000').fontSize(16).text('Treatment Case Sheet');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000');
    doc.text(`Patient: ${data.patientName}  (${data.patientCode})`);
    doc.text(`Age/Sex: ${data.patientAge} / ${data.patientGender}`);
    doc.text(`Plan: ${data.planName}`);
    doc.text(`Status: ${data.status}`);
    doc.text(`Started: ${day(data.createdAt)}`);
    if (data.estimatedCostPaise > 0) doc.text(`Estimated cost: ${rupees(data.estimatedCostPaise)}`);

    // ── Page 2: sittings ────────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(16).fillColor('#000').text('Procedures & Sittings');
    doc.moveDown(0.5);
    data.procedures.forEach((p) => {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(
        `${p.name}${p.toothNumbers.length ? ` · Tooth ${p.toothNumbers.join(', ')}` : ''}`,
      );
      doc.font('Helvetica').fontSize(10).fillColor('#333').text(
        `${p.completedSittings} of ${p.totalSittings} sittings · ${p.status}`,
      );
      doc.moveDown(0.3);
      p.sittings.forEach((s) => {
        doc.fontSize(10).fillColor('#000').text(
          `${s.completed ? '✓' : '○'} Sitting ${s.sittingNumber} · ${day(s.date)}${s.notes ? ` · ${s.notes}` : ''}`,
        );
      });
      doc.moveDown(0.6);
    });

    // ── Page 3: prescriptions (if any) ──────────────────────────────────────
    if (data.prescriptions.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor('#000').text('Prescriptions');
      doc.moveDown(0.5);
      data.prescriptions.forEach((rx) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(day(rx.date));
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        rx.medicines.forEach((m) => {
          doc.text(
            `   • ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` · ${m.frequency}` : ''}${m.durationDays ? ` · ${m.durationDays} day(s)` : ''}`,
          );
        });
        doc.moveDown(0.5);
      });
    }

    // ── Page 4: x-rays (if any) ─────────────────────────────────────────────
    if (data.xrayCount > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor('#000').text('X-rays');
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333').text(
        `${data.xrayCount} x-ray${data.xrayCount === 1 ? '' : 's'} attached to this plan's visits. View them in the patient's Media tab.`,
      );
    }

    doc.end();
  });
}
