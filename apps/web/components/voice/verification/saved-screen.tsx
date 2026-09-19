'use client';

import { MascotMoment } from '@/components/illustrations/mascot-moment';
import { Button } from '@/components/ui/button';
import { Mini } from '@/components/ui/badge';

/**
 * Frame 31 — saved.
 *
 * The mascot is banned on the verification card itself (Global Constraint 12); this is a
 * separate success screen, where it is allowed and is the point.
 *
 * The outcome chips are the frame's real idea: the doctor learns what their words CAUSED —
 * a prescription PDF, a bill waiting at the desk, an appointment on the book — rather than
 * a generic "Saved". Each is rendered only when it actually happened.
 */
export function SavedScreen({
  patientFirstName,
  outcomes,
  nextPatientName,
  onCallNext,
  onBackToFlow,
}: {
  patientFirstName: string;
  outcomes: { text: string; tone: 'live' | 'lime' | 'sky' }[];
  nextPatientName?: string | null;
  onCallNext?: () => void;
  onBackToFlow?: () => void;
}) {
  return (
    <div className="flex w-full max-w-mobile flex-1 flex-col items-center justify-center px-gutter text-center">
      <MascotMoment pose="celebrate" size="xl" animation="bounce-in" />

      <p className="mt-4 text-[21px] font-heavy tracking-tight text-pine">
        Saved to {patientFirstName}&apos;s record
      </p>

      {outcomes.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {outcomes.map((o) => (
            <Mini key={o.text} tone={o.tone}>
              {o.text}
            </Mini>
          ))}
        </div>
      ) : null}

      {/* "Call next" is the frame's primary action, and it is the right one: the doctor's
          next move after filing a record is the next patient, not a menu. It only renders
          when there IS a next patient — an empty chair gets "Back to Flow" alone. */}
      <div className="mt-6 flex w-full flex-col items-center gap-3">
        {nextPatientName ? (
          <Button block onClick={onCallNext} className="max-w-[280px]">
            Call next · {nextPatientName}
          </Button>
        ) : null}
        <button type="button" onClick={onBackToFlow} className="text-[13px] font-heavy text-pine-2">
          Back to Flow
        </button>
      </div>
    </div>
  );
}
