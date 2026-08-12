"use client";

import { useState } from "react";
import type { ClinicalExtraction } from "@odovox/types";
import { GlassCard } from "@/components/ds";
import { useConsultStore } from "@/lib/consult/store";
import { invalidFields } from "@/lib/consult/card-view";
import {
  hasUnresolvedBlocking,
  type SafetyViewItem,
} from "@/lib/consult/safety-view";
import { useToast } from "@/lib/toast";
import { IdentityHeader } from "./verification/identity-header";
import { RecordFields } from "./verification/record-fields";
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
 * This file is now the ORCHESTRATOR only: it owns the card's state (what is being edited,
 * whether the draft is dirty, whether the preview is open) and composes the sections in
 * `./verification/`. The rendered DOM is unchanged from when all of it lived here — that
 * is the point of the split, so a later restyle can be bisected apart from this move.
 */
export function VerificationCard({
  data,
  safety,
}: {
  data: ClinicalExtraction;
  safety: SafetyViewItem[];
}) {
  const { edit, confirm, rerecord } = useConsultStore.getState();
  const state = useConsultStore((s) => s.state);
  const toast = useToast();
  const confirming = state.kind === "CONFIRMING";
  const [editing, setEditing] = useState<string | null>(null);
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
    <GlassCard
      tone="light"
      border="soft"
      className="relative flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
    >
      <IdentityHeader
        confirmRerecord={confirmRerecord}
        onRerecord={onRerecord}
        onBlur={() => setConfirmRerecord(false)}
      />

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <RecordFields
          data={data}
          invalid={invalid}
          editing={editing}
          setEditing={setEditing}
          onApply={apply}
        />
        <MedicineList data={data} onEdit={applyEdit} />
        <LabCaseBlock data={data} onEdit={applyEdit} />
        <SafetyBanner safety={safety} />
      </div>

      <SaveActions
        blocked={blocked}
        confirming={confirming}
        onOpenPreview={() => setPreview(true)}
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
    </GlassCard>
  );
}
