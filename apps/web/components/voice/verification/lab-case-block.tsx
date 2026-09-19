'use client';

import type { ClinicalExtraction } from '@odovox/types';

/**
 * A suggested lab case (Phase 9.7 §2.5.1). Keep creates a DRAFT on confirm; Skip drops it.
 *
 * It is a DRAFT on purpose: shade, photos and the lab itself are chosen later, and a case
 * sent to a lab with guessed details costs a remake. The suggestion exists so the doctor
 * does not have to remember to raise one, not so the app can raise one on their behalf.
 */
export function LabCaseBlock({
  data,
  onEdit,
}: {
  data: ClinicalExtraction;
  onEdit: (next: ClinicalExtraction) => void;
}) {
  if (!data.labCaseSuggestion) return null;
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold tracking-widest text-text-subtle">LAB CASE SUGGESTED</p>
      <div className="rounded-2xl border border-lavender bg-lavender-soft/40 p-3">
        <p className="text-sm font-semibold text-ink">
          Draft: {data.labCaseSuggestion.type.replaceAll('_', ' ').toLowerCase()}
          {data.labCaseSuggestion.teeth.length ? ` · Tooth ${data.labCaseSuggestion.teeth.join(', ')}` : ''}
          {data.labCaseSuggestion.dueInDays ? ` · Due ~${data.labCaseSuggestion.dueInDays} days` : ''}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">Shade, photos, and lab will be added before sending.</p>
        <div className="mt-2 flex gap-2">
          <span className="rounded-pill bg-lime px-3 py-1 text-xs font-medium text-ink">Keep draft</span>
          <button
            type="button"
            onClick={() => onEdit({ ...data, labCaseSuggestion: null })}
            className="rounded-pill bg-paper-warm px-3 py-1 text-xs font-medium text-text-muted"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
