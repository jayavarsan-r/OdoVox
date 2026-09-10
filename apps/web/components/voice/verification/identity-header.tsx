'use client';

import { ChevronRight, Pencil } from 'lucide-react';
import type { ClinicalExtraction } from '@odovox/types';
import { IconCircle } from '@/components/ds';
import { reviewSubtitle } from '@/lib/consult/card-view';

/**
 * Frame 27's header: "Review", then the patient and what was done, then a pen.
 *
 * The patient NAME comes from the caller, which reads it off the patient DB record — never
 * off the extraction. A mis-heard name on a clinical record is the failure this whole
 * surface exists to prevent, and a regression test asserts the card reads no identity
 * fields from `data`.
 *
 * The pen toggles free edit. The frames are a READ surface — prose and figures a doctor
 * scans in three seconds — but every field behind them is still editable, so the pen
 * reveals the full row editors rather than removing them.
 */
export function IdentityHeader({
  data,
  patientName,
  editing,
  onToggleEdit,
  onOpenPatient,
}: {
  data: ClinicalExtraction;
  patientName: string;
  editing: boolean;
  onToggleEdit: () => void;
  onOpenPatient?: () => void;
}) {
  const subtitle = reviewSubtitle(data);

  return (
    <header className="flex items-start justify-between gap-3 px-gutter pt-1">
      <div className="min-w-0 flex-1">
        <h2 className="text-[25px] font-heavy leading-none tracking-tight text-pine">Review</h2>
        <p className="mt-[7px] flex min-w-0 items-center gap-1 text-[12.5px] leading-tight">
          <button
            type="button"
            onClick={onOpenPatient}
            className="truncate font-heavy text-pine"
          >
            {patientName}
          </button>
          {subtitle ? (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-hair-2" aria-hidden />
              <span className="truncate font-bold text-pine-2">{subtitle}</span>
            </>
          ) : null}
        </p>
      </div>
      <IconCircle
        size="md"
        tone="surface"
        aria-label={editing ? 'Done editing' : 'Edit the record'}
        aria-pressed={editing}
        onClick={onToggleEdit}
      >
        <Pencil />
      </IconCircle>
    </header>
  );
}
