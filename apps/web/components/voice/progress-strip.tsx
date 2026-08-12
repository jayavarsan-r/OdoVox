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
 *
 * NOTHING about the pipeline reaches this screen. The dentist's model is
 * RECORD → Processing → AI Review; upload, transcription, extraction, provider names and
 * stage vocabulary are implementation, and a clinician has no use for any of it. The
 * transcript is deliberately NOT rendered here either — it is still carried by the
 * TRANSCRIBED state and still reaches extraction and review, it just is not shown mid-wait.
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

/**
 * Takes NO state. That is the enforcement, not an oversight: a component that cannot see
 * which pipeline stage is running cannot leak one. The ruling ("do not expose the dentist
 * to the internal processing pipeline") is therefore structural rather than a convention
 * someone has to remember.
 */
export function ProgressStrip({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <MascotMoment pose="thinking" size="lg" animation="float" />

      <p className="mt-3 text-[19px] font-heavy tracking-tight text-pine">
        Processing
      </p>
      <div
        role="progressbar"
        aria-label="Processing your recording"
        className="mt-3.5 h-1.5 w-full overflow-hidden rounded-sm bg-hair-2"
      >
        <motion.span
          className="block h-full w-1/3 rounded-sm bg-lime"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Under the bar, as frame 25 has it: the bar answers "is it alive?", the line
          answers "how long?". Reversed, the estimate reads as a caption for the title. */}
      <p className="mt-3 text-[12.5px] font-semibold text-pine-2">
        Usually under 20 seconds
      </p>

    </div>
  );
}
