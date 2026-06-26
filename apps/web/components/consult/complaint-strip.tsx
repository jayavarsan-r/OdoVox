'use client';

import type { ConsultationContext } from '@odovox/types';
import { recordingStripText } from '@/lib/consult/context-view';
import { XrayCountChip } from './xray-strip';

/** Compact strip kept visible during recording so the doctor can refer to the complaint (§2.3). */
export function ComplaintStrip({ ctx }: { ctx: ConsultationContext }) {
  return (
    <div className="mx-5 flex items-center justify-between gap-2 rounded-lg bg-paper-warm px-3 py-2">
      <span className="min-w-0 truncate text-sm text-ink">{recordingStripText(ctx)}</span>
      <XrayCountChip count={ctx.xrays.length} />
    </div>
  );
}
