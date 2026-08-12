'use client';

import type { ClinicalExtraction } from '@odovox/types';
import { Button } from '@/components/ui/button';
import {
  setCost,
  setFollowUp,
  setNotes,
  setProcedure,
  setSittings,
  setStatus,
  setTeeth,
} from '@/lib/consult/editors';
import { parseTeethInput } from '@/lib/consult/card-view';
import { rupees } from '@/lib/billing/format';
import { cn } from '@/lib/utils';
import { FIELD_INPUT, FIELD_INPUT_SM, FieldRow } from './field-row';

/**
 * The clinical record itself: procedure, teeth, sittings, status, next visit, fee, notes.
 *
 * Every row edits in place — no modal stacking — and every edit goes straight back out
 * through `onEdit`, which autosaves. Partial work survives a dropped tab or a failed
 * confirm, because a doctor who has spent two minutes correcting an extraction must not
 * lose it to a flaky network.
 *
 * Fee and Notes are here because dictated cost and advice were being extracted with
 * nowhere to show them (Phase 9.6 Issue 8/16) — data captured but unverifiable.
 */
export function RecordFields({
  data,
  invalid,
  editing,
  setEditing,
  onApply,
}: {
  data: ClinicalExtraction;
  invalid: Set<string>;
  editing: string | null;
  setEditing: (next: string | null) => void;
  /** Applies the edit AND closes the open editor — every row here edits one value. */
  onApply: (next: ClinicalExtraction) => void;
}) {
  const toggle = (key: string) => () => setEditing(editing === key ? null : key);

  return (
    <>
      <FieldRow
        label="Procedure"
        value={data.procedure ?? '—'}
        confirmed={!!data.procedure}
        onEdit={toggle('procedure')}
      >
        {editing === 'procedure' ? (
          <input
            autoFocus
            defaultValue={data.procedure ?? ''}
            onBlur={(e) => onApply(setProcedure(data, e.target.value.trim() || null))}
            className={FIELD_INPUT}
          />
        ) : null}
      </FieldRow>

      <FieldRow
        label="Tooth / teeth"
        value={data.teeth.length ? data.teeth.join(', ') : '—'}
        confirmed={data.teeth.length > 0 && !invalid.has('teeth')}
        invalid={invalid.has('teeth')}
        onEdit={toggle('teeth')}
      >
        {editing === 'teeth' ? (
          <input
            autoFocus
            defaultValue={data.teeth.join(', ')}
            onBlur={(e) => onApply(setTeeth(data, parseTeethInput(e.target.value)))}
            placeholder="e.g. 26, 38 (FDI)"
            className={FIELD_INPUT}
          />
        ) : null}
      </FieldRow>

      <FieldRow
        label="Sittings"
        value={data.sittingCurrent != null ? `${data.sittingCurrent} / ${data.sittingTotal ?? '?'}` : '—'}
        confirmed={data.sittingCurrent != null && !invalid.has('sittings')}
        invalid={invalid.has('sittings')}
        onEdit={toggle('sittings')}
      >
        {editing === 'sittings' ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              defaultValue={data.sittingCurrent ?? 1}
              id="sit-cur"
              className={FIELD_INPUT_SM}
            />
            <span className="text-text-subtle">/</span>
            <input
              type="number"
              defaultValue={data.sittingTotal ?? 1}
              id="sit-tot"
              className={FIELD_INPUT_SM}
            />
            <Button
              size="sm"
              onClick={() => {
                const cur = Number((document.getElementById('sit-cur') as HTMLInputElement).value);
                const tot = Number((document.getElementById('sit-tot') as HTMLInputElement).value);
                onApply(setSittings(data, cur, tot));
              }}
            >
              Save
            </Button>
          </div>
        ) : null}
      </FieldRow>

      <FieldRow label="Status" value={data.status ?? '—'} confirmed={!!data.status} onEdit={toggle('status')}>
        {editing === 'status' ? (
          <div className="mt-2 flex gap-2">
            {(['IN_PROGRESS', 'COMPLETED', 'ABORTED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onApply(setStatus(data, s))}
                className={cn(
                  'rounded-pill px-3 py-1 text-xs font-medium',
                  data.status === s ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted',
                )}
              >
                {s === 'IN_PROGRESS' ? 'In progress' : s === 'COMPLETED' ? 'Completed' : 'Aborted'}
              </button>
            ))}
          </div>
        ) : null}
      </FieldRow>

      <FieldRow
        label="Next visit"
        value={data.followUp?.afterDays != null ? `In ${data.followUp.afterDays} days` : '—'}
        confirmed={data.followUp?.afterDays != null}
        onEdit={toggle('followup')}
      >
        {editing === 'followup' ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-text-muted">In</span>
            <input
              type="number"
              defaultValue={data.followUp?.afterDays ?? 7}
              onBlur={(e) => {
                const n = Number(e.target.value);
                onApply(setFollowUp(data, n > 0 ? n : null, data.followUp?.procedureHint ?? null));
              }}
              className={FIELD_INPUT_SM}
            />
            <span className="text-sm text-text-muted">days</span>
          </div>
        ) : null}
      </FieldRow>

      <FieldRow
        label="Fee"
        value={data.estimatedCostPaise != null ? rupees(data.estimatedCostPaise) : '—'}
        confirmed={data.estimatedCostPaise != null}
        onEdit={toggle('fee')}
      >
        {editing === 'fee' ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-text-muted">₹</span>
            <input
              type="number"
              inputMode="numeric"
              defaultValue={data.estimatedCostPaise != null ? data.estimatedCostPaise / 100 : ''}
              onBlur={(e) => {
                const n = Number(e.target.value);
                onApply(setCost(data, n > 0 ? Math.round(n * 100) : null));
              }}
              className="w-32 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </FieldRow>

      <FieldRow label="Notes" value={data.notes ?? '—'} confirmed={!!data.notes} onEdit={toggle('notes')}>
        {editing === 'notes' ? (
          <textarea
            autoFocus
            defaultValue={data.notes ?? ''}
            rows={2}
            placeholder="e.g. Patient advised no hot or cold foods"
            onBlur={(e) => onApply(setNotes(data, e.target.value.trim() || null))}
            className={FIELD_INPUT}
          />
        ) : null}
      </FieldRow>
    </>
  );
}
