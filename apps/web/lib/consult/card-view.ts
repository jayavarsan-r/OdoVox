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
