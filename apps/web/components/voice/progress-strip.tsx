"use client";

import { motion } from "framer-motion";
import type { ConsultState } from "@/lib/consult/machine";
import { MascotMoment } from "@/components/illustrations/mascot-moment";
import { cn } from "@/lib/utils";

/**
 * Frame 25 — processing.
 *
 * This used to render three stage chips: Sent / Listening… / Making sense of it…. The
 * frame deletes them, and says why in its own note:
 *
 *   "Stage chips deleted — three visible steps made 15 seconds feel like three waits.
 *    Now: Odo + Processing + a moving bar and an honest time expectation."
 *
 * So the pipeline is unchanged — upload, STT and extraction all still run and still emit
 * their events — but the doctor sees ONE wait with a moving bar and a real estimate,
 * instead of a progress meter that stalls three times.
 *
 * The bar is INDETERMINATE on purpose. The server reports stage transitions, not
 * percentages, so a filling bar would be inventing a number. A looping sweep says "still
 * working" without claiming to know how far along it is.
 */

/** True while the pipeline owns the screen. */
export function isProcessing(kind: ConsultState["kind"]): boolean {
  return (
    kind === "UPLOADING" ||
    kind === "TRANSCRIBING" ||
    kind === "TRANSCRIBED" ||
    kind === "EXTRACTING"
  );
}

export function ProgressStrip({
  state,
  className,
}: {
  state: ConsultState;
  className?: string;
}) {
  // Kept, deliberately: the transcript is the doctor's own words coming back, and it is
  // the first proof the audio survived. The frame has no transcript because its mock is
  // mid-upload — dropping it on a real screen that HAS one would remove information the
  // frame never decided against. Rendered quietly, under the bar.
  const transcript =
    state.kind === "TRANSCRIBED" ? state.transcript : undefined;

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <MascotMoment pose="thinking" size="lg" animation="float" />

      <p className="mt-3 text-[19px] font-heavy tracking-tight text-pine">
        Processing
      </p>
      <p className="mt-[3px] text-[12.5px] font-semibold text-pine-2">
        Usually under 20 seconds
      </p>

      <div
        role="progressbar"
        aria-label="Processing your recording"
        className="mt-4 h-1.5 w-full overflow-hidden rounded-sm bg-hair-2"
      >
        <motion.span
          className="block h-full w-1/3 rounded-sm bg-lime"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {transcript ? (
        <p className="mt-3 line-clamp-3 text-[12.5px] font-medium italic leading-[1.5] text-pine-2">
          “{transcript}”
        </p>
      ) : null}
    </div>
  );
}
