'use client';

import type { ConsultationContext } from '@odovox/types';
import { recordingStripText } from '@/lib/consult/context-view';
import { XrayCountChip } from './xray-strip';

/** The complaint, kept in view for the whole recording (§2.3). Frame 23 draws it as a
 * centred pill beneath the ring stack; the x-ray count rides along so the doctor still
 * knows there are films to look at without leaving the screen. */
export function ComplaintStrip({ ctx }: { ctx: ConsultationContext }) {
  const line = recordingStripText(ctx);
  // No complaint and no films means the chip would be an empty pill. Frame 23 has no
  // such element, and neither should the screen.
  if (!line && ctx.xrays.length === 0) return null;

  return (
    <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-pill bg-hair/70 px-3.5 py-1.5">
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-pine-2">
        {line}
      </span>
      <XrayCountChip count={ctx.xrays.length} />
    </div>
  );
}
