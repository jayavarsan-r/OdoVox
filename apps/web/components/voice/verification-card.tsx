"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ClinicalExtraction } from "@odovox/types";
import { BentoTile } from "@/components/ds";
import { useConsultStore } from "@/lib/consult/store";
import { invalidFields } from "@/lib/consult/card-view";
import {
  hasUnresolvedBlocking,
  type SafetyViewItem,
} from "@/lib/consult/safety-view";
import { useToast } from "@/lib/toast";
import { IdentityHeader } from "./verification/identity-header";
import { SummaryBento } from "./verification/summary-bento";
import { RecordFields } from "./verification/record-fields";
import { RecordProse } from "./verification/record-prose";
import { MedicineList } from "./verification/medicine-list";
import { LabCaseBlock } from "./verification/lab-case-block";
import { SafetyBanner } from "./verification/safety-banner";
import { PreviewSheet, SaveActions } from "./verification/actions";

/**
 * The verification card — the doctor's main working surface (Phase 9.6 Issue 6/16),
 * full-page on the consult route. Nothing commits until Save. Invariants:
 * (a) Re-record stays available, but a card with edits asks before discarding them.
 * (b) Safety warnings are never silently dismissed — resolved ones re-render with a check, not gone.
 * (c) Per-field editors expand inline (no modal stacking); every edit PATCHes the draft to the
 *     server immediately, so partial work survives a dropped tab or a failed confirm.
 * (d) Saving passes through a Preview step — the doctor sees the exact summary before it commits.
 *
 * Frames 27-30 are a READ surface: a bento of the three facts worth checking, the medicines
 * with any conflict drawn on the drug, and the record as prose. That is the common case —
 * glance, agree, confirm — and it needs no editing at all.
 *
 * Editing did not go anywhere. The header's pen toggles `editing`, which swaps the bento
 * and prose for the full row editors. Every field the old card could change, this one still
 * can; the frames just stopped making a doctor read a form to approve four correct values.
 *
 * No mascot here (Global Constraint 12) — frame 31's success screen is a separate surface.
 */
export function VerificationCard({
  data,
  safety,
  patientName,
  nextSittingLine,
  onOpenPatient,
  onOpenNextSitting,
}: {
  data: ClinicalExtraction;
  safety: SafetyViewItem[];
  /** From the patient DB record — NEVER from the extraction. */
  patientName: string;
  nextSittingLine?: string | null;
  onOpenPatient?: () => void;
  onOpenNextSitting?: () => void;
}) {
  const { edit, confirm, rerecord } = useConsultStore.getState();
  const state = useConsultStore((s) => s.state);
  const toast = useToast();
  const confirming = state.kind === "CONFIRMING";
  const [editing, setEditing] = useState<string | null>(null);
  const [freeEdit, setFreeEdit] = useState(false);
  const [edited, setEdited] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmRerecord, setConfirmRerecord] = useState(false);
  const blocked = hasUnresolvedBlocking(safety);
  const invalid = invalidFields(safety);

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
    <div className="relative flex max-h-full min-h-0 flex-1 flex-col">
      <IdentityHeader
        data={data}
        patientName={patientName}
        editing={freeEdit}
        onToggleEdit={() => setFreeEdit((v) => !v)}
        onOpenPatient={onOpenPatient}
      />

      <div className="flex-1 overflow-y-auto pb-4">
        {freeEdit ? (
          <div className="px-gutter pt-3">
            <RecordFields
              data={data}
              invalid={invalid}
              editing={editing}
              setEditing={setEditing}
              onApply={apply}
            />
          </div>
        ) : (
          <SummaryBento
            data={data}
            nextSittingLine={nextSittingLine}
            onOpenNextSitting={onOpenNextSitting}
          />
        )}

        {/* Frame 30's clean state. It is worth a whole strip rather than a quiet absence
            of red: "nothing was flagged" and "nothing was checked" look identical on a
            screen that only ever speaks up about problems, and the doctor confirming a
            prescription deserves to know which one they are looking at. */}
        {safety.length === 0 ? (
          <div className="mt-[13px] px-gutter">
            <BentoTile tone="live">
              <span className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-live" aria-hidden />
                <span className="text-[12.5px] font-heavy leading-tight text-live">
                  All checks passed — no allergy or drug conflicts
                </span>
              </span>
            </BentoTile>
          </div>
        ) : null}

        <MedicineList data={data} safety={safety} onEdit={applyEdit} />

        {freeEdit ? null : <RecordProse data={data} />}

        <div className="px-gutter">
          <LabCaseBlock data={data} onEdit={applyEdit} />
          {/* The banner carries warnings with no medicine to sit on (invalid tooth,
              sitting overflow). Drug conflicts render on their own row instead — the flag
              belongs on the drug, not in a banner away from it. */}
          <SafetyBanner
            safety={safety.filter((s) => !s.detail || s.blocking)}
          />
        </div>
      </div>

      <SaveActions
        blocked={blocked}
        confirming={confirming}
        onOpenPreview={() => setPreview(true)}
        onRerecord={onRerecord}
        rerecordLabel={
          confirmRerecord ? "Discard edits & re-record?" : "Re-record"
        }
        onRerecordBlur={() => setConfirmRerecord(false)}
      />

      {/* Preview step (Issue 16): the doctor sees the exact summary before anything commits.
          A server-surfaced blocking error dismisses it so the red rows are visible. */}
      {preview && !blocked ? (
        <PreviewSheet
          data={data}
          confirming={confirming}
          onEditMore={() => setPreview(false)}
          onConfirm={() =>
            confirm().catch((err) => {
              setPreview(false);
              toast.apiError(err);
            })
          }
        />
      ) : null}
    </div>
  );
}
