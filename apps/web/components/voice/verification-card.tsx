'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ClinicalExtraction, ExtractedPrescription, MedicineFrequency } from '@odovox/types';
import { GlassCard } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { useConsultStore } from '@/lib/consult/store';
import {
  addMedicine,
  removeMedicine,
  setFollowUp,
  setProcedure,
  setSittings,
  setStatus,
  setTeeth,
} from '@/lib/consult/editors';
import { hasUnresolvedBlocking, type SafetyViewItem } from '@/lib/consult/safety-view';
import { cn } from '@/lib/utils';

const FREQ: MedicineFrequency[] = ['OD', 'BD', 'TID', 'QID', 'SOS'];

function Row({
  label,
  value,
  confirmed,
  onEdit,
  children,
}: {
  label: string;
  value: string;
  confirmed?: boolean;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-[13px] text-text-muted">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{value}</span>
        {confirmed ? <Check className="size-4 text-sage-deep" /> : null}
        {onEdit ? (
          <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className="text-text-subtle">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SafetyCard({ item }: { item: SafetyViewItem }) {
  return (
    <div
      className={cn(
        'rounded-2xl p-3',
        item.resolved ? 'bg-sage-tint' : 'bg-warning-soft',
      )}
    >
      <div className="flex items-start gap-2">
        {item.resolved ? (
          <Check className="mt-0.5 size-4 shrink-0 text-sage-deep" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        )}
        <p className={cn('text-[13px]', item.resolved ? 'text-sage-deep line-through' : 'text-ink')}>
          {item.message}
          {item.blocking && !item.resolved ? ' (must fix before confirming)' : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * The verification card — the gate. Nothing commits until the doctor taps Confirm. Three invariants:
 * (a) Re-record is always available (header link → resets to recording, audits the reject).
 * (b) Safety warnings are never silently dismissed — resolved ones re-render with a check, not gone.
 * (c) Per-field editors expand inline (no modal stacking).
 */
export function VerificationCard({ data, safety }: { data: ClinicalExtraction; safety: SafetyViewItem[] }) {
  const { edit, confirm, rerecord } = useConsultStore.getState();
  const state = useConsultStore((s) => s.state);
  const confirming = state.kind === 'CONFIRMING';
  const [editing, setEditing] = useState<string | null>(null);
  const blocked = hasUnresolvedBlocking(safety);

  const apply = (next: ClinicalExtraction) => {
    edit(next);
    setEditing(null);
  };

  return (
    <GlassCard
      tone="light"
      border="soft"
      className="flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl rounded-b-none"
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-lg font-semibold text-ink">Here&apos;s what I understood</h2>
        <button type="button" onClick={() => void rerecord()} className="text-sm font-medium text-text-muted">
          Re-record
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <Row
          label="Procedure"
          value={data.procedure ?? '—'}
          confirmed={!!data.procedure}
          onEdit={() => setEditing(editing === 'procedure' ? null : 'procedure')}
        >
          {editing === 'procedure' ? (
            <input
              autoFocus
              defaultValue={data.procedure ?? ''}
              onBlur={(e) => apply(setProcedure(data, e.target.value.trim() || null))}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          ) : null}
        </Row>

        <Row
          label="Tooth / teeth"
          value={data.teeth.length ? data.teeth.join(', ') : '—'}
          confirmed={data.teeth.length > 0}
          onEdit={() => setEditing(editing === 'teeth' ? null : 'teeth')}
        >
          {editing === 'teeth' ? (
            <input
              autoFocus
              defaultValue={data.teeth.join(', ')}
              onBlur={(e) =>
                apply(
                  setTeeth(
                    data,
                    e.target.value
                      .split(/[,\s]+/)
                      .map((n) => Number(n))
                      .filter((n) => Number.isInteger(n) && n > 0),
                  ),
                )
              }
              placeholder="e.g. 26, 38 (FDI)"
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          ) : null}
        </Row>

        <Row
          label="Sittings"
          value={data.sittingCurrent != null ? `${data.sittingCurrent} / ${data.sittingTotal ?? '?'}` : '—'}
          confirmed={data.sittingCurrent != null}
          onEdit={() => setEditing(editing === 'sittings' ? null : 'sittings')}
        >
          {editing === 'sittings' ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                defaultValue={data.sittingCurrent ?? 1}
                id="sit-cur"
                className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <span className="text-text-subtle">/</span>
              <input
                type="number"
                defaultValue={data.sittingTotal ?? 1}
                id="sit-tot"
                className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  const cur = Number((document.getElementById('sit-cur') as HTMLInputElement).value);
                  const tot = Number((document.getElementById('sit-tot') as HTMLInputElement).value);
                  apply(setSittings(data, cur, tot));
                }}
              >
                Save
              </Button>
            </div>
          ) : null}
        </Row>

        <Row
          label="Status"
          value={data.status ?? '—'}
          confirmed={!!data.status}
          onEdit={() => setEditing(editing === 'status' ? null : 'status')}
        >
          {editing === 'status' ? (
            <div className="mt-2 flex gap-2">
              {(['IN_PROGRESS', 'COMPLETED', 'ABORTED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => apply(setStatus(data, s))}
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
        </Row>

        <Row
          label="Next visit"
          value={data.followUp?.afterDays != null ? `In ${data.followUp.afterDays} days` : '—'}
          confirmed={data.followUp?.afterDays != null}
          onEdit={() => setEditing(editing === 'followup' ? null : 'followup')}
        >
          {editing === 'followup' ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-text-muted">In</span>
              <input
                type="number"
                defaultValue={data.followUp?.afterDays ?? 7}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  apply(setFollowUp(data, n > 0 ? n : null, data.followUp?.procedureHint ?? null));
                }}
                className="w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <span className="text-sm text-text-muted">days</span>
            </div>
          ) : null}
        </Row>

        {/* Prescription section */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest text-text-subtle">
              PRESCRIPTION · {data.prescriptions.length}
            </p>
            <button
              type="button"
              onClick={() =>
                edit(addMedicine(data, { name: 'New medicine', dosage: null, frequency: null, durationDays: null, instructions: null }))
              }
              className="flex items-center gap-1 text-sm font-medium text-info"
            >
              <Plus className="size-4" /> Add medicine
            </button>
          </div>
          {data.prescriptions.length === 0 ? (
            <p className="rounded-2xl bg-paper-warm p-3 text-[13px] text-text-muted">
              No medicines. The app never adds one you didn&apos;t prescribe.
            </p>
          ) : (
            <div className="space-y-2">
              {data.prescriptions.map((rx, i) => (
                <MedicineRow
                  key={i}
                  rx={rx}
                  onChange={(next) => edit({ ...data, prescriptions: data.prescriptions.map((p, j) => (j === i ? next : p)) })}
                  onRemove={() => edit(removeMedicine(data, i))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Safety section — never silently dismissable */}
        {safety.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold tracking-widest text-text-subtle">
              SAFETY · {safety.filter((s) => !s.resolved).length}
            </p>
            {safety.map((item, i) => (
              <SafetyCard key={i} item={item} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/60 p-4" style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}>
        <Button
          variant="primary"
          size="lg"
          loading={confirming}
          disabled={blocked || confirming}
          onClick={() => void confirm()}
          className="w-full shadow-lime-glow"
        >
          {blocked ? 'Resolve safety issues to confirm' : 'Confirm & send to front desk'}
        </Button>
      </div>
    </GlassCard>
  );
}

function MedicineRow({
  rx,
  onChange,
  onRemove,
}: {
  rx: ExtractedPrescription;
  onChange: (next: ExtractedPrescription) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(rx.name === 'New medicine');
  const summary = [rx.name, rx.dosage, rx.frequency, rx.durationDays ? `${rx.durationDays} days` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{summary}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Edit medicine" className="text-text-subtle">
          <Pencil className="size-4" />
        </button>
        <button type="button" onClick={onRemove} aria-label="Remove medicine" className="text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>
      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            defaultValue={rx.name === 'New medicine' ? '' : rx.name}
            placeholder="Name"
            onBlur={(e) => onChange({ ...rx, name: e.target.value.trim() || rx.name })}
            className="col-span-2 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            defaultValue={rx.dosage ?? ''}
            placeholder="Dosage (e.g. 500mg)"
            onBlur={(e) => onChange({ ...rx, dosage: e.target.value.trim() || null })}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            type="number"
            defaultValue={rx.durationDays ?? ''}
            placeholder="Days"
            onBlur={(e) => onChange({ ...rx, durationDays: Number(e.target.value) || null })}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <div className="col-span-2 flex gap-1.5">
            {FREQ.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onChange({ ...rx, frequency: f })}
                className={cn(
                  'rounded-pill px-3 py-1 text-xs font-medium',
                  rx.frequency === f ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
