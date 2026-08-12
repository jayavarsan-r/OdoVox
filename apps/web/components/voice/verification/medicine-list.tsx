'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ClinicalExtraction, ExtractedPrescription, MedicineFrequency } from '@odovox/types';
import {
  MedicineList as MedicineCard,
  MedicineRow as DsMedicineRow,
  SectionHeader,
} from '@/components/ds';
import type { SafetyViewItem } from '@/lib/consult/safety-view';
import { addMedicine, removeMedicine } from '@/lib/consult/editors';
import { medicineDose, medicinesState } from '@/lib/consult/card-view';
import { cn } from '@/lib/utils';

const FREQ: MedicineFrequency[] = ['OD', 'BD', 'TID', 'QID', 'SOS'];

/** The safety warning attached to this medicine, if any. */
function conflictFor(rx: ExtractedPrescription, safety: SafetyViewItem[]): SafetyViewItem | undefined {
  const name = rx.name.trim().toLowerCase();
  return safety.find((s) => !s.resolved && s.detail?.trim().toLowerCase() === name);
}

function MedicineEditor({
  rx,
  onChange,
  onRemove,
  onClose,
}: {
  rx: ExtractedPrescription;
  onChange: (next: ExtractedPrescription) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mx-3 mb-2 grid grid-cols-2 gap-2 rounded-xl bg-paper p-3">
      <input
        defaultValue={rx.name === 'New medicine' ? '' : rx.name}
        placeholder="Name"
        onBlur={(e) => onChange({ ...rx, name: e.target.value.trim() || rx.name })}
        className="col-span-2 rounded-lg border border-hair bg-white px-3 py-2 text-sm"
      />
      <input
        defaultValue={rx.dosage ?? ''}
        placeholder="Dosage (e.g. 500mg)"
        onBlur={(e) => onChange({ ...rx, dosage: e.target.value.trim() || null })}
        className="rounded-lg border border-hair bg-white px-3 py-2 text-sm"
      />
      <input
        type="number"
        defaultValue={rx.durationDays ?? ''}
        placeholder="Days"
        onBlur={(e) => onChange({ ...rx, durationDays: Number(e.target.value) || null })}
        className="rounded-lg border border-hair bg-white px-3 py-2 text-sm"
      />
      <div className="col-span-2 flex flex-wrap gap-1.5">
        {FREQ.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange({ ...rx, frequency: f })}
            className={cn(
              'rounded-pill px-3 py-1 text-xs font-heavy',
              rx.frequency === f ? 'bg-lime text-pine' : 'bg-white text-pine-2',
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="col-span-2 flex items-center justify-between pt-1">
        <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs font-heavy text-crit">
          <Trash2 className="size-3.5" /> Remove
        </button>
        <button type="button" onClick={onClose} className="text-xs font-heavy text-pine-2">
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * Frames 27-29 — the medicines section.
 *
 * Frame 29's requirement is the load-bearing one: SEVEN medicines render with the same
 * anatomy as two. One row each, dose chip right-aligned, nothing squeezed, no scroll
 * region of its own. A prescription list that degrades as it grows is a list a doctor
 * stops reading, and long lists are exactly when a mistake hides.
 *
 * A conflict is drawn ON the drug, not in a banner: red rail, red name, one factual line
 * saying what the allergy is and when it was recorded. No pink wash and no AI voice — it
 * reads like a chart annotation, because that is what a dentist already knows how to read.
 */
export function MedicineList({
  data,
  safety,
  onEdit,
}: {
  data: ClinicalExtraction;
  safety: SafetyViewItem[];
  onEdit: (next: ClinicalExtraction) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const state = medicinesState(safety);

  return (
    <>
      <SectionHeader
        title={`Medicines · ${data.prescriptions.length}`}
        action={state.text}
        actionTone={state.tone === 'crit' ? 'crit' : 'live'}
      />

      <div className="px-gutter">
        {data.prescriptions.length === 0 ? (
          <p className="rounded-xl bg-white p-3 text-[12.5px] font-semibold text-pine-2 shadow-elev-1">
            No medicines. The app never adds one you didn&apos;t prescribe.
          </p>
        ) : (
          <MedicineCard>
            {data.prescriptions.map((rx, i) => {
              const conflict = conflictFor(rx, safety);
              const change = (next: ExtractedPrescription) =>
                onEdit({ ...data, prescriptions: data.prescriptions.map((p, j) => (j === i ? next : p)) });

              return (
                <div key={i}>
                  <DsMedicineRow
                    name={rx.name}
                    dose={medicineDose(rx)}
                    frequency={rx.frequency}
                    doseCaption={rx.instructions ?? undefined}
                    onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                    conflict={
                      conflict
                        ? {
                            fact: conflict.message,
                            // The frame's action is "Swap → Azithro 500", which needs a
                            // drug-substitution knowledge base the app does not have
                            // (deviation #51). Removing the medicine is the resolution
                            // the safety model actually recognises, so that is what the
                            // button does — and it says so, rather than implying the app
                            // picked a replacement drug.
                            action: (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(removeMedicine(data, i));
                                }}
                                className="shrink-0 rounded-pill bg-pine px-3 py-1.5 text-2xs font-heavy text-white"
                              >
                                Remove
                              </button>
                            ),
                          }
                        : undefined
                    }
                  />
                  {editingIndex === i ? (
                    <MedicineEditor
                      rx={rx}
                      onChange={change}
                      onRemove={() => {
                        onEdit(removeMedicine(data, i));
                        setEditingIndex(null);
                      }}
                      onClose={() => setEditingIndex(null)}
                    />
                  ) : null}
                </div>
              );
            })}
          </MedicineCard>
        )}

        <button
          type="button"
          onClick={() => {
            onEdit(
              addMedicine(data, {
                name: 'New medicine',
                dosage: null,
                frequency: null,
                durationDays: null,
                instructions: null,
              }),
            );
            setEditingIndex(data.prescriptions.length);
          }}
          className="mt-2.5 flex items-center gap-1 text-[12.5px] font-heavy text-pine-2"
        >
          <Plus className="size-4" /> Add medicine
        </button>
      </div>
    </>
  );
}
