'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ClinicalExtraction, ExtractedPrescription, MedicineFrequency } from '@odovox/types';
import { addMedicine, removeMedicine } from '@/lib/consult/editors';
import { medicineSummary } from '@/lib/consult/card-view';
import { cn } from '@/lib/utils';

const FREQ: MedicineFrequency[] = ['OD', 'BD', 'TID', 'QID', 'SOS'];

function MedicineRow({
  rx,
  onChange,
  onRemove,
}: {
  rx: ExtractedPrescription;
  onChange: (next: ExtractedPrescription) => void;
  onRemove: () => void;
}) {
  // A freshly added medicine opens expanded — it has nothing to summarise yet, and the
  // doctor who just tapped Add is about to type into it.
  const [open, setOpen] = useState(rx.name === 'New medicine');

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{medicineSummary(rx)}</span>
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

/**
 * The prescription section.
 *
 * The empty state says the quiet part out loud — "The app never adds one you didn't
 * prescribe." A doctor has to trust that an AI-filled prescription list contains only
 * what they said, and an empty list is the strongest moment to make that promise.
 */
export function MedicineList({
  data,
  onEdit,
}: {
  data: ClinicalExtraction;
  onEdit: (next: ClinicalExtraction) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-widest text-text-subtle">
          PRESCRIPTION · {data.prescriptions.length}
        </p>
        <button
          type="button"
          onClick={() =>
            onEdit(addMedicine(data, { name: 'New medicine', dosage: null, frequency: null, durationDays: null, instructions: null }))
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
              onChange={(next) => onEdit({ ...data, prescriptions: data.prescriptions.map((p, j) => (j === i ? next : p)) })}
              onRemove={() => onEdit(removeMedicine(data, i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
