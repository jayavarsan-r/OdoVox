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
  setCost,
  setFollowUp,
  setNotes,
  setProcedure,
  setSittings,
  setStatus,
  setTeeth,
} from '@/lib/consult/editors';
import { hasUnresolvedBlocking, type SafetyViewItem } from '@/lib/consult/safety-view';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const FREQ: MedicineFrequency[] = ['OD', 'BD', 'TID', 'QID', 'SOS'];

function Row({
  label,
  value,
  confirmed,
  invalid,
  onEdit,
  children,
}: {
  label: string;
  value: string;
  confirmed?: boolean;
  invalid?: boolean;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-b border-border/60 py-3 last:border-0',
        invalid && 'rounded-xl border border-danger/40 bg-danger/5 px-3',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-[13px] text-text-muted">{label}</span>
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', invalid ? 'text-danger' : 'text-ink')}>
          {value}
        </span>
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
  const blockingActive = item.blocking && !item.resolved;
  return (
    <div
      className={cn(
        'rounded-2xl p-3',
        item.resolved ? 'bg-sage-tint' : blockingActive ? 'bg-danger/10' : 'bg-warning-soft',
      )}
    >
      <div className="flex items-start gap-2">
        {item.resolved ? (
          <Check className="mt-0.5 size-4 shrink-0 text-sage-deep" />
        ) : (
          <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', blockingActive ? 'text-danger' : 'text-warning')} />
        )}
        <p className={cn('text-[13px]', item.resolved ? 'text-sage-deep line-through' : 'text-ink')}>
          {item.message}
          {blockingActive ? ' (must fix before confirming)' : ''}
        </p>
      </div>
    </div>
  );
}

/** One line of the pre-save preview — label + value, values from the FINAL edited data. */
function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-24 shrink-0 text-[13px] text-text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * The verification card — the doctor's main working surface (Phase 9.6 Issue 6/16), full-page on
 * the consult route. Nothing commits until Save. Invariants:
 * (a) Re-record stays available, but a card with edits asks before discarding them.
 * (b) Safety warnings are never silently dismissed — resolved ones re-render with a check, not gone.
 * (c) Per-field editors expand inline (no modal stacking); every edit PATCHes the draft to the
 *     server immediately, so partial work survives a dropped tab or a failed confirm.
 * (d) Saving passes through a Preview step — the doctor sees the exact summary before it commits.
 */
export function VerificationCard({ data, safety }: { data: ClinicalExtraction; safety: SafetyViewItem[] }) {
  const { edit, confirm, rerecord } = useConsultStore.getState();
  const state = useConsultStore((s) => s.state);
  const toast = useToast();
  const confirming = state.kind === 'CONFIRMING';
  const [editing, setEditing] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmRerecord, setConfirmRerecord] = useState(false);
  const blocked = hasUnresolvedBlocking(safety);
  // Fields the server (or client) flagged with an unresolved BLOCKING error — their rows go red.
  const invalidFields = new Set(safety.filter((s) => s.blocking && !s.resolved && s.field).map((s) => s.field));

  // Every card edit funnels through here: marks the draft dirty (guards Re-record) and
  // autosaves via the store's PATCH.
  const applyEdit = (next: ClinicalExtraction) => {
    setEdited(true);
    edit(next);
  };
  const apply = (next: ClinicalExtraction) => {
    applyEdit(next);
    setEditing(null);
  };

  // Smart re-record: an untouched card re-records immediately; an edited one asks first (two-tap).
  const onRerecord = () => {
    if (edited && !confirmRerecord) {
      setConfirmRerecord(true);
      return;
    }
    void rerecord();
  };

  return (
    <GlassCard
      tone="light"
      border="soft"
      className="relative flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-lg font-semibold text-ink">Here&apos;s what I understood</h2>
        <button
          type="button"
          onClick={onRerecord}
          onBlur={() => setConfirmRerecord(false)}
          className={cn('text-sm font-medium', confirmRerecord ? 'text-danger' : 'text-text-muted')}
        >
          {confirmRerecord ? 'Discard edits & re-record?' : 'Re-record'}
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
          confirmed={data.teeth.length > 0 && !invalidFields.has('teeth')}
          invalid={invalidFields.has('teeth')}
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
          confirmed={data.sittingCurrent != null && !invalidFields.has('sittings')}
          invalid={invalidFields.has('sittings')}
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

        {/* Fee + Notes rows (Phase 9.6 Issue 8/16) — dictated cost and advice were extracted but
            had no home on the card, so the doctor couldn't see or fix them before saving. */}
        <Row
          label="Fee"
          value={data.estimatedCostPaise != null ? rupees(data.estimatedCostPaise) : '—'}
          confirmed={data.estimatedCostPaise != null}
          onEdit={() => setEditing(editing === 'fee' ? null : 'fee')}
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
                  apply(setCost(data, n > 0 ? Math.round(n * 100) : null));
                }}
                className="w-32 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          ) : null}
        </Row>

        <Row
          label="Notes"
          value={data.notes ?? '—'}
          confirmed={!!data.notes}
          onEdit={() => setEditing(editing === 'notes' ? null : 'notes')}
        >
          {editing === 'notes' ? (
            <textarea
              autoFocus
              defaultValue={data.notes ?? ''}
              rows={2}
              placeholder="e.g. Patient advised no hot or cold foods"
              onBlur={(e) => apply(setNotes(data, e.target.value.trim() || null))}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
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
                applyEdit(addMedicine(data, { name: 'New medicine', dosage: null, frequency: null, durationDays: null, instructions: null }))
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
                  onChange={(next) => applyEdit({ ...data, prescriptions: data.prescriptions.map((p, j) => (j === i ? next : p)) })}
                  onRemove={() => applyEdit(removeMedicine(data, i))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lab case suggested (Phase 9.7 §2.5.1) — Keep creates a DRAFT on confirm; Skip drops it. */}
        {data.labCaseSuggestion ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold tracking-widest text-text-subtle">LAB CASE SUGGESTED</p>
            <div className="rounded-2xl border border-lavender bg-lavender-soft/40 p-3">
              <p className="text-sm font-semibold text-ink">
                Draft: {data.labCaseSuggestion.type.replaceAll('_', ' ').toLowerCase()}
                {data.labCaseSuggestion.teeth.length ? ` · Tooth ${data.labCaseSuggestion.teeth.join(', ')}` : ''}
                {data.labCaseSuggestion.dueInDays ? ` · Due ~${data.labCaseSuggestion.dueInDays} days` : ''}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">Shade, photos, and lab will be added before sending.</p>
              <div className="mt-2 flex gap-2">
                <span className="rounded-pill bg-lime px-3 py-1 text-xs font-medium text-ink">Keep draft</span>
                <button
                  type="button"
                  onClick={() => applyEdit({ ...data, labCaseSuggestion: null })}
                  className="rounded-pill bg-paper-warm px-3 py-1 text-xs font-medium text-text-muted"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
          onClick={() => setPreview(true)}
          className="w-full shadow-lime-glow"
        >
          {blocked ? 'Resolve safety issues to confirm' : 'Save findings'}
        </Button>
      </div>

      {/* Preview step (Issue 16): the doctor sees the exact summary before anything commits.
          A server-surfaced blocking error dismisses it so the red rows are visible. */}
      {preview && !blocked ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-ink/30">
          <div className="rounded-t-3xl bg-surface p-5" style={{ paddingBottom: 'calc(20px + var(--safe-bottom))' }}>
            <h3 className="mb-2 text-base font-semibold text-ink">Preview</h3>
            <PreviewLine
              label="Procedure"
              value={[
                data.procedure ?? '—',
                data.teeth.length ? `Tooth ${data.teeth.join(', ')}` : null,
                data.sittingCurrent != null ? `Sitting ${data.sittingCurrent} of ${data.sittingTotal ?? '?'}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <PreviewLine
              label="Prescription"
              value={
                data.prescriptions.length
                  ? data.prescriptions
                      .map((rx) =>
                        [rx.name, rx.dosage, rx.frequency, rx.durationDays ? `${rx.durationDays} days` : null]
                          .filter(Boolean)
                          .join(' '),
                      )
                      .join('; ')
                  : '—'
              }
            />
            <PreviewLine
              label="Follow-up"
              value={data.followUp?.afterDays != null ? `In ${data.followUp.afterDays} days` : '—'}
            />
            <PreviewLine label="Fee" value={data.estimatedCostPaise != null ? rupees(data.estimatedCostPaise) : '—'} />
            <PreviewLine label="Notes" value={data.notes ?? '—'} />
            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPreview(false)}>
                Edit more
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={confirming}
                disabled={confirming}
                onClick={() =>
                  confirm().catch((err) => {
                    setPreview(false);
                    toast.apiError(err);
                  })
                }
              >
                Save &amp; send to front desk
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
