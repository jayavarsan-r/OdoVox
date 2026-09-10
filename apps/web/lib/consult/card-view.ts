import type { ClinicalExtraction, ExtractedPrescription } from "@odovox/types";
import { rupees } from "../billing/format";
import type { SafetyViewItem } from "./safety-view";

/**
 * View-model for the verification card. Everything here was inline in the component and
 * is pure: given the extraction, produce the strings and sets the card renders.
 *
 * Splitting it out is not tidiness. These are the calculations that decide what a doctor
 * reads before committing a clinical record — which rows turn red, what the preview claims
 * is about to be saved — and they were untestable while they lived inside JSX.
 */

/**
 * Fields the server (or client) flagged with an unresolved BLOCKING error. Their rows go
 * red and the card cannot be confirmed. Resolved warnings deliberately do NOT appear: a
 * resolved warning re-renders with a check, it is never silently dropped.
 */
export function invalidFields(safety: SafetyViewItem[]): Set<string> {
  return new Set(
    safety
      .filter((s) => s.blocking && !s.resolved && s.field)
      .map((s) => s.field as string),
  );
}

/**
 * Free-text teeth input → FDI numbers. Accepts commas, spaces or both ("26, 38", "26 38").
 * Anything that is not a positive integer is dropped rather than coerced — a typo must not
 * become tooth 0, and a silently wrong tooth number is a wrong-site clinical record.
 */
export function parseTeethInput(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** One medicine as the collapsed row shows it: "Amoxicillin · 500mg · TID · 5 days". */
export function medicineSummary(rx: ExtractedPrescription): string {
  return [
    rx.name,
    rx.dosage,
    rx.frequency,
    rx.durationDays ? `${rx.durationDays} days` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The label/value pairs of the pre-save preview, built from the FINAL edited data. */
export function previewLines(
  data: ClinicalExtraction,
): { label: string; value: string }[] {
  return [
    {
      label: "Procedure",
      value: [
        data.procedure ?? "—",
        data.teeth.length ? `Tooth ${data.teeth.join(", ")}` : null,
        data.sittingCurrent != null
          ? `Sitting ${data.sittingCurrent} of ${data.sittingTotal ?? "?"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: "Prescription",
      value: data.prescriptions.length
        ? data.prescriptions
            .map((rx) =>
              [
                rx.name,
                rx.dosage,
                rx.frequency,
                rx.durationDays ? `${rx.durationDays} days` : null,
              ]
                .filter(Boolean)
                .join(" "),
            )
            .join("; ")
        : "—",
    },
    {
      label: "Follow-up",
      value:
        data.followUp?.afterDays != null
          ? `In ${data.followUp.afterDays} days`
          : "—",
    },
    {
      label: "Fee",
      value:
        data.estimatedCostPaise != null ? rupees(data.estimatedCostPaise) : "—",
    },
    { label: "Notes", value: data.notes ?? "—" },
  ];
}

/** A tile of the frame-27 summary bento. */
export interface BentoValue {
  label: string;
  value: string;
  caption?: string;
}

/**
 * The bento's TOOTH and FEES tiles (frame 27).
 *
 * Teeth join with "·" rather than "," because the frame sets them as a pair of large
 * numerals ("11 · 21"), not a list. Fees carry the per-unit breakdown as a caption when
 * there is more than one tooth — frame 30's "₹4,500 × 2 crowns" — since a doctor
 * checking a bill wants the arithmetic, not just the total.
 */
export function bentoTiles(data: ClinicalExtraction): {
  teeth: BentoValue;
  fees: BentoValue;
} {
  const count = data.teeth.length;
  return {
    teeth: {
      label: count === 1 ? 'TOOTH' : 'TEETH',
      value: count ? data.teeth.join(' · ') : '—',
      caption:
        data.procedure && count > 1 ? `${data.procedure} · ${count} teeth` : (data.procedure ?? undefined),
    },
    fees: {
      label: 'FEES',
      value: data.estimatedCostPaise != null ? rupees(data.estimatedCostPaise) : '—',
      caption:
        data.estimatedCostPaise != null && count > 1
          ? `${rupees(Math.round(data.estimatedCostPaise / count))} × ${count}`
          : undefined,
    },
  };
}

/** The identity line under "Review": "Anand Kumar › RCT 36 · Sitting 2". */
export function reviewSubtitle(data: ClinicalExtraction): string {
  return [
    data.procedure ? [data.procedure, data.teeth.join(', ')].filter(Boolean).join(' ') : null,
    data.sittingCurrent != null ? `Sitting ${data.sittingCurrent}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The prose sections of the record (frames 27-30's PaperBlock).
 *
 * The frames show FINDINGS, PROCEDURE and INSTRUCTIONS as three narrative paragraphs.
 * Only the last has a source: `notes` is where dictated patient advice lands. FINDINGS and
 * a PROCEDURE narrative are not extracted at all — adding them means new schema fields and
 * new prompt work, which is clinical extraction, not a restyle (deviation #52). Sections
 * without data are omitted rather than shown empty, and nothing here is invented.
 */
export function proseSections(data: ClinicalExtraction): { label: string; body: string }[] {
  const out: { label: string; body: string }[] = [];
  if (data.notes?.trim()) out.push({ label: 'INSTRUCTIONS', body: data.notes.trim() });
  return out;
}

/**
 * Frame 27's medicines-section state line. Takes the DRUG-attached warnings only — passing
 * it every warning made an invalid tooth number read as "1 conflict" beside a prescription
 * list that was perfectly fine, sending the doctor hunting through the drugs.
 */
export function medicinesState(safety: SafetyViewItem[]): { text: string; tone: 'crit' | 'live' } {
  const open = safety.filter((s) => !s.resolved).length;
  if (open > 0) return { text: `${open} conflict${open > 1 ? 's' : ''}`, tone: 'crit' };
  // "checked" once something was raised and dealt with; "no conflicts" when nothing ever
  // was. The distinction matters — a doctor should be able to tell "I resolved that" from
  // "there was never anything to resolve".
  return { text: safety.length ? '✓ checked' : '✓ no conflicts', tone: 'live' };
}

/** The right-aligned dose chip on a medicine row: "1-1-1 · 5 days". */
export function medicineDose(rx: ExtractedPrescription): string | undefined {
  const parts = [
    rx.dosage,
    rx.frequency,
    rx.durationDays ? `${rx.durationDays} days` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Frame 27's NEXT SITTING tile: "Thu 16 Jul · obturation".
 *
 * Built from the extraction's follow-up, which is a RELATIVE interval ("in 7 days") plus
 * an optional procedure hint. The appointment itself does not exist yet — it is created by
 * the confirm transaction — so the tile shows the date that interval lands on and NOT a
 * time. Inventing "10:00" here would put a specific slot in front of the doctor that
 * nobody has booked, and they would tell the patient.
 */
export function nextSittingLine(data: ClinicalExtraction, from: Date): string | null {
  const days = data.followUp?.afterDays;
  if (days == null) return null;

  const when = new Date(from);
  when.setDate(when.getDate() + days);
  const date = when.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });

  return [date, data.followUp?.procedureHint].filter(Boolean).join(' · ');
}

/**
 * Frame 31's outcome chips — what the doctor's words actually caused.
 *
 * Each one is rendered only when it really happened. A chip claiming an Rx PDF that does
 * not exist, or a bill nobody raised, is worse than no chip: the doctor stops checking.
 */
export function savedOutcomes(
  data: ClinicalExtraction,
  from: Date,
): { text: string; tone: 'live' | 'lime' | 'sky' }[] {
  const out: { text: string; tone: 'live' | 'lime' | 'sky' }[] = [];
  // Each chip is toned by WHERE the work went, so the doctor reads three destinations at
  // a glance rather than three sentences: the patient's hand, the front desk, the diary.
  if (data.prescriptions.length) out.push({ text: '✓ Rx PDF ready', tone: 'live' });
  if (data.estimatedCostPaise != null)
    out.push({ text: `${rupees(data.estimatedCostPaise)} → checkout`, tone: 'lime' });
  const next = nextSittingLine(data, from);
  if (next) out.push({ text: `${next.split(' · ')[0]} booked`, tone: 'sky' });
  return out;
}

/**
 * Warning codes that are about a MEDICINE. The rest (invalid_tooth, sitting_overflow,
 * sitting_jump) are about the procedure and have no drug row to sit on. Kept in step with
 * `isResolved` in safety-view.ts, which switches on the same codes.
 */
const DRUG_WARNING_CODES = new Set([
  'allergy_conflict',
  'drug_interaction',
  'antibiotic_duration',
  'pediatric_dosage',
  'pregnancy_risk',
]);

/**
 * Split safety warnings by whether a currently-prescribed medicine can carry them.
 *
 * The verification card draws a drug conflict ON the drug — red rail, red name, one
 * factual line — because a flag in a banner away from the prescription is a flag the
 * doctor has to correlate by hand. But that only works while the drug is still on the
 * list. The moment they resolve the conflict by removing it, the warning has no row to
 * live on, and filtering it out of the banner too made it disappear entirely.
 *
 * That silently broke the card's invariant (b): a resolved warning re-renders with a
 * check, it is NEVER removed. "I dealt with that" and "nothing was ever raised" must not
 * look the same, or the audit the doctor performs in their head stops being possible.
 *
 * So the split is by ATTACHMENT, not by resolution: anything a visible medicine row can
 * host goes on the row, and everything else — resolved conflicts, invalid teeth, sitting
 * overflows — goes to the banner.
 */
export function partitionSafety(
  safety: SafetyViewItem[],
  data: ClinicalExtraction,
): { onDrug: SafetyViewItem[]; standalone: SafetyViewItem[]; drugRelated: SafetyViewItem[] } {
  const prescribed = new Set(data.prescriptions.map((p) => p.name.trim().toLowerCase()));
  const onDrug: SafetyViewItem[] = [];
  const standalone: SafetyViewItem[] = [];

  for (const s of safety) {
    const drug = s.detail?.trim().toLowerCase();
    if (!s.resolved && drug && prescribed.has(drug)) onDrug.push(s);
    else standalone.push(s);
  }
  // Whether a warning is ABOUT a drug is decided by its code, not by whether that drug is
  // still prescribed — removing the medicine resolves the conflict, it does not turn the
  // conflict into a tooth problem. The section's state line counts this set, so frame 28's
  // "✓ checked" survives the resolution that earned it.
  const drugRelated = safety.filter((s) => DRUG_WARNING_CODES.has(s.code));
  return { onDrug, standalone, drugRelated };
}
