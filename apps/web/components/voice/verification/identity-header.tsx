'use client';

import { cn } from '@/lib/utils';

/**
 * The card's header. Carries no patient identity of its own — deliberately.
 *
 * The identity strip lives on the consult page and reads from the patient DB record. If
 * this header rendered a name it would be rendering the EXTRACTION's idea of who the
 * patient is, and a mis-heard name on a clinical record is the failure this whole surface
 * exists to prevent. A regression test asserts the card never reads identity fields
 * off the extraction at all.
 *
 * Re-record is here rather than with the save actions because it is the escape hatch, not
 * a peer of Confirm. An edited card asks before discarding — two taps, same button.
 */
export function IdentityHeader({
  confirmRerecord,
  onRerecord,
  onBlur,
}: {
  confirmRerecord: boolean;
  onRerecord: () => void;
  onBlur: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      <h2 className="text-lg font-semibold text-ink">Here&apos;s what I understood</h2>
      <button
        type="button"
        onClick={onRerecord}
        onBlur={onBlur}
        className={cn('text-sm font-medium', confirmRerecord ? 'text-danger' : 'text-text-muted')}
      >
        {confirmRerecord ? 'Discard edits & re-record?' : 'Re-record'}
      </button>
    </header>
  );
}
