'use client';

import { ChevronRight } from 'lucide-react';
import type { ClinicalExtraction } from '@odovox/types';
import { BentoTile } from '@/components/ds';
import { bentoTiles } from '@/lib/consult/card-view';

/**
 * The tooth outline beside the number (frame 27). Local rather than a design-system
 * component because it has exactly one home; promote it if a second frame wants it.
 */
function ToothGlyph() {
  return (
    <svg viewBox="0 0 20 22" className="size-[19px] shrink-0" fill="none" aria-hidden>
      <path
        d="M10 2.2c2.6-1.6 6-1.5 7.4.6 1.5 2.2.8 5-.2 8-.7 2.2-.9 4.6-1.5 7.2-.3 1.4-.7 2.2-1.4 2.2-.9 0-1.2-1.1-1.5-2.8-.4-2.1-.6-4.4-1.4-5.5-.4-.6-1.6-.6-2 0-.8 1.1-1 3.4-1.4 5.5-.3 1.7-.6 2.8-1.5 2.8-.7 0-1.1-.8-1.4-2.2-.6-2.6-.8-5-1.5-7.2-1-3-1.7-5.8-.2-8C5.4.7 8.8.6 10 2.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-pine"
      />
    </svg>
  );
}

/**
 * Frame 27's summary: the three facts a doctor checks before committing — which tooth,
 * what it costs, when they are seeing the patient next.
 *
 * These are read tiles, not inputs. Every value is editable behind the header's pen; the
 * bento exists so the common case (glance, agree, confirm) needs no editing at all.
 */
export function SummaryBento({
  data,
  nextSittingLine,
  onOpenNextSitting,
}: {
  data: ClinicalExtraction;
  /** "Thu 16 Jul · 10:00 · obturation" — built by the caller from the real appointment. */
  nextSittingLine?: string | null;
  onOpenNextSitting?: () => void;
}) {
  const { teeth, fees } = bentoTiles(data);

  return (
    <div className="mt-[13px] grid grid-cols-2 gap-[9px] px-gutter">
      <BentoTile tone="lime" label={teeth.label}>
        <span className="mt-[3px] flex items-center gap-2">
          <ToothGlyph />
          <span className="text-[31px] font-heavy leading-none tracking-tight tabular-nums text-pine">
            {teeth.value}
          </span>
        </span>
        {teeth.caption ? (
          <span className="mt-1.5 block text-3xs font-bold leading-tight text-pine-2">
            {teeth.caption}
          </span>
        ) : null}
      </BentoTile>

      <BentoTile tone="neutral" label={fees.label}>
        <span className="mt-[3px] block text-[27px] font-heavy leading-none tracking-tight tabular-nums text-pine">
          {fees.value}
        </span>
        {fees.caption ? (
          <span className="mt-1.5 block text-3xs font-bold leading-tight text-pine-2">
            {fees.caption}
          </span>
        ) : null}
      </BentoTile>

      {nextSittingLine ? (
        <BentoTile tone="sky" label="NEXT SITTING" span={2}>
          <button
            type="button"
            onClick={onOpenNextSitting}
            className="mt-[3px] flex w-full items-center gap-2 text-left"
          >
            <span className="min-w-0 flex-1 text-[16px] font-heavy leading-tight tracking-snug text-sky">
              {nextSittingLine}
            </span>
            <ChevronRight className="size-4 shrink-0 text-sky" aria-hidden />
          </button>
        </BentoTile>
      ) : null}
    </div>
  );
}
