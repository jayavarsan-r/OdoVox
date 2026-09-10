'use client';

import type { ClinicalExtraction } from '@odovox/types';
import { PaperBlock, PaperSection } from '@/components/ds';
import { proseSections } from '@/lib/consult/card-view';

/**
 * The narrative half of the record (frames 27-30).
 *
 * The frames set this as chart prose behind a rule — FINDINGS, PROCEDURE, INSTRUCTIONS —
 * because that is how a dentist reads a record: sentences, not a form. Sections with no
 * data are omitted; none of this is generated to fill the shape.
 */
export function RecordProse({ data }: { data: ClinicalExtraction }) {
  const sections = proseSections(data);
  if (sections.length === 0) return null;

  return (
    <PaperBlock className="mx-gutter">
      {sections.map((s) => (
        <PaperSection key={s.label} label={s.label}>
          <p className="text-[14.5px] font-semibold leading-[1.5] text-pine">{s.body}</p>
        </PaperSection>
      ))}
    </PaperBlock>
  );
}
