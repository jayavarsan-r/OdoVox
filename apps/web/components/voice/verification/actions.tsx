'use client';

import type { ClinicalExtraction } from '@odovox/types';
import { Button } from '@/components/ui/button';
import { previewLines } from '@/lib/consult/card-view';

/** One line of the pre-save preview — label + value, values from the FINAL edited data. */
function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-24 shrink-0 text-[13px] text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * The save path, which is deliberately two steps.
 *
 * Nothing commits from the card itself. Saving opens a preview showing exactly what is
 * about to be written, and only the preview's own button calls `confirm()`. The doctor
 * verifies the summary rather than trusting that seven separate rows added up to what
 * they meant — this is a clinical record, and the review is the product.
 *
 * The CTA is disabled while any blocking safety warning is unresolved, and says so
 * instead of just greying out: "Resolve safety issues to confirm" tells the doctor what
 * to do, where a dead button tells them nothing.
 */
export function SaveActions({
  blocked,
  confirming,
  onOpenPreview,
  onRerecord,
  rerecordLabel,
  onRerecordBlur,
}: {
  blocked: boolean;
  confirming: boolean;
  onOpenPreview: () => void;
  onRerecord: () => void;
  rerecordLabel: string;
  onRerecordBlur: () => void;
}) {
  return (
    <div
      className="sticky bottom-0 mt-auto bg-gradient-to-t from-paper via-paper to-transparent px-gutter pt-4"
      style={{ paddingBottom: 'calc(10px + var(--safe-bottom))' }}
    >
      <Button
        block
        size="lg"
        loading={confirming}
        disabled={blocked || confirming}
        onClick={onOpenPreview}
      >
        {blocked ? 'Resolve safety issues to confirm' : 'Confirm & save'}
      </Button>
      {/* Re-record sits under the CTA as a text action, not a button — frame 27 makes it
          reachable without ever making it a peer of Confirm. */}
      <button
        type="button"
        onClick={onRerecord}
        onBlur={onRerecordBlur}
        className="mt-2.5 w-full text-center text-[12.5px] font-heavy text-pine-2"
      >
        {rerecordLabel}
      </button>
    </div>
  );
}

/**
 * The preview sheet (Issue 16). A server-surfaced blocking error dismisses it so the red
 * rows underneath are visible — the doctor is sent back to the problem, not left staring
 * at a summary that will not save.
 */
export function PreviewSheet({
  data,
  confirming,
  onEditMore,
  onConfirm,
}: {
  data: ClinicalExtraction;
  confirming: boolean;
  onEditMore: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-ink/30">
      <div className="rounded-t-3xl bg-surface p-5" style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
        <h3 className="mb-2 text-base font-semibold text-ink">Preview</h3>
        {previewLines(data).map((line) => (
          <PreviewLine key={line.label} label={line.label} value={line.value} />
        ))}
        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onEditMore}>
            Edit more
          </Button>
          <Button variant="primary" className="flex-1" loading={confirming} disabled={confirming} onClick={onConfirm}>
            Save &amp; send to front desk
          </Button>
        </div>
      </div>
    </div>
  );
}
