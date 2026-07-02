'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import type { InventoryAdjustExtraction, InventoryConsumeExtraction, InventoryPurchaseExtraction, InventoryItemMatch } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/forms/Select';
import { VoiceInput } from '@/components/voice/voice-input';
import { api } from '@/lib/api-client';
import { useInventoryCategories } from '@/lib/inventory-queries';
import {
  buildAdjustApplyPlan,
  buildConsumeApplyPlan,
  buildPurchaseApplyPlan,
  type AdjustRow,
  type ConsumeRow,
  type PurchaseRow,
} from '@/lib/inventory-voice';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Sage chip naming the matched catalog item, or a peach "new item" marker. */
function MatchChip({ match }: { match: InventoryItemMatch | null }) {
  return match ? (
    <span className="inline-flex items-center gap-1 rounded-pill bg-sage-tint px-2 py-0.5 text-[11px] font-medium text-sage-deep">
      <Check className="size-3" /> {match.name}
    </span>
  ) : (
    <span className="rounded-pill bg-peach-soft px-2 py-0.5 text-[11px] font-medium text-ink">New item</span>
  );
}

function RowShell({ skipped, onSkip, children }: { skipped: boolean; onSkip: () => void; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-2 rounded-lg border border-border bg-paper-warm p-3', skipped && 'opacity-45')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">{children}</div>
        <button type="button" aria-label={skipped ? 'Include row' : 'Skip row'} onClick={onSkip} className="mt-0.5 flex size-6 items-center justify-center rounded-pill bg-paper text-text-subtle">
          {skipped ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

type PurchaseResponse = { extraction: Omit<InventoryPurchaseExtraction, 'items'> & { items: Array<InventoryPurchaseExtraction['items'][number] & { match: InventoryItemMatch | null }> }; transcript: string };

/** 🎙 Voice log purchase — dictate → verify rows → apply via the existing movement endpoints. */
export function VoicePurchaseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const categories = useInventoryCategories();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const activeCategories = categories.data?.items.filter((c) => !c.isArchived) ?? [];

  const patch = (i: number, p: Partial<PurchaseRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function apply() {
    const { steps, blocked } = buildPurchaseApplyPlan(rows);
    if (blocked.length) {
      toast.error(`Needs attention: ${blocked.join(', ')}`);
      return;
    }
    if (!steps.length) return;
    setBusy(true);
    try {
      for (const step of steps) {
        let itemId = step.kind === 'purchase' ? step.itemId : null;
        if (step.kind === 'create-item') {
          const created = await api.post<{ id: string }>('/inventory/items', {
            categoryId: step.categoryId,
            name: step.name,
            unitOfMeasure: 'piece',
            reorderLevel: 0,
            ...(step.vendorName ? { vendorName: step.vendorName } : {}),
          });
          itemId = created.id;
        }
        await api.post(`/inventory/items/${itemId}/purchase`, {
          quantity: step.quantity,
          pricePerUnitPaise: step.unitPricePaise,
          ...(step.batchNumber ? { batchNumber: step.batchNumber } : {}),
          ...(step.expiryDate ? { expiryDate: step.expiryDate } : {}),
          ...(step.vendorName ? { vendorName: step.vendorName } : {}),
        });
      }
      toast.success(`Logged ${steps.length} purchase${steps.length > 1 ? 's' : ''}.`);
      void qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setRows([]);
      onClose();
    } catch (e) {
      toast.apiError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Voice log purchase">
      <div className="space-y-3">
        <VoiceInput<PurchaseResponse>
          mode="extraction"
          endpoint="/inventory/dictate/purchase"
          placement="sheet"
          label="Speak the purchase"
          hint="items · quantities · prices · vendor"
          autoStart={open && rows.length === 0}
          onExtraction={({ extraction }) => {
            setRows(extraction.items.map((it) => ({ ...it, createCategoryId: null, skipped: false })));
            if (extraction.clarifications.length) toast.info(extraction.clarifications.join(' '));
          }}
        />
        {rows.map((row, i) => (
          <RowShell key={i} skipped={!!row.skipped} onSkip={() => patch(i, { skipped: !row.skipped })}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold capitalize text-ink">{row.name}</span>
              <MatchChip match={row.match} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-text-muted">
                Qty
                <Input type="number" inputMode="numeric" value={row.quantity} onChange={(e) => patch(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <label className="text-xs text-text-muted">
                Unit price (₹)
                <Input
                  type="number"
                  inputMode="decimal"
                  value={row.unitPricePaise === null ? '' : row.unitPricePaise / 100}
                  placeholder="required"
                  onChange={(e) => patch(i, { unitPricePaise: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })}
                />
              </label>
            </div>
            {!row.match ? (
              <label className="block text-xs text-text-muted">
                New item — will create under
                <Select value={row.createCategoryId ?? ''} onChange={(e) => patch(i, { createCategoryId: e.target.value || null })}>
                  <option value="">Pick a category…</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </label>
            ) : null}
          </RowShell>
        ))}
        {rows.length ? (
          <Button className="w-full" onClick={apply} loading={busy}>
            Log {rows.filter((r) => !r.skipped).length} purchase{rows.filter((r) => !r.skipped).length === 1 ? '' : 's'}
          </Button>
        ) : null}
      </div>
    </BottomSheet>
  );
}

type ConsumeResponse = { extraction: Omit<InventoryConsumeExtraction, 'items'> & { items: Array<{ name: string; quantity: number; match: InventoryItemMatch | null; insufficientStock: boolean }> }; transcript: string };

/** 🎙 Voice log usage — "used 5 gloves and 2 carpules for this filling". */
export function VoiceConsumeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<ConsumeRow[]>([]);
  const [procedure, setProcedure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, p: Partial<ConsumeRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function apply() {
    const { steps, blocked } = buildConsumeApplyPlan(rows);
    if (blocked.length) {
      toast.error(`Needs attention: ${blocked.join(', ')}`);
      return;
    }
    if (!steps.length) return;
    setBusy(true);
    try {
      for (const step of steps) {
        await api.post(`/inventory/items/${step.itemId}/consume`, {
          quantity: step.quantity,
          ...(procedure ? { procedureName: procedure } : {}),
        });
      }
      toast.success(`Logged usage of ${steps.length} item${steps.length > 1 ? 's' : ''}.`);
      void qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setRows([]);
      onClose();
    } catch (e) {
      toast.apiError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Voice log usage">
      <div className="space-y-3">
        <VoiceInput<ConsumeResponse>
          mode="extraction"
          endpoint="/inventory/dictate/consume"
          placement="sheet"
          label="Speak what was used"
          hint="“Used 5 gloves and 2 carpules for this filling”"
          autoStart={open && rows.length === 0}
          onExtraction={({ extraction }) => {
            setRows(extraction.items.map((it) => ({ ...it, skipped: false })));
            setProcedure(extraction.procedureName);
            if (extraction.clarifications.length) toast.info(extraction.clarifications.join(' '));
          }}
        />
        {procedure ? <p className="text-xs text-text-muted">For: <span className="font-medium capitalize text-ink">{procedure}</span></p> : null}
        {rows.map((row, i) => (
          <RowShell key={i} skipped={!!row.skipped} onSkip={() => patch(i, { skipped: !row.skipped })}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold capitalize text-ink">{row.name}</span>
              <MatchChip match={row.match} />
            </div>
            <label className="block text-xs text-text-muted">
              Qty
              <Input type="number" inputMode="numeric" value={row.quantity} onChange={(e) => patch(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            {row.match && row.match.currentStock < row.quantity ? (
              <p className="text-xs font-medium text-danger">Only {row.match.currentStock} in stock</p>
            ) : null}
            {!row.match ? <p className="text-xs text-text-muted">Not in your catalog — skip or add it first.</p> : null}
          </RowShell>
        ))}
        {rows.length ? (
          <Button className="w-full" onClick={apply} loading={busy}>
            Log usage
          </Button>
        ) : null}
      </div>
    </BottomSheet>
  );
}

type AdjustResponse = { extraction: Omit<InventoryAdjustExtraction, 'items'> & { items: Array<{ name: string; newCount: number; match: InventoryItemMatch | null }> }; transcript: string };

/** 🎙 Voice stock count (ADMIN) — absolute corrected counts + a required reason. */
export function VoiceAdjustSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<AdjustRow[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (i: number, p: Partial<AdjustRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function apply() {
    if (!reason.trim()) {
      toast.error('A reason is required for stock adjustments.');
      return;
    }
    const { steps, blocked } = buildAdjustApplyPlan(rows);
    if (blocked.length) {
      toast.error(`Needs attention: ${blocked.join(', ')}`);
      return;
    }
    if (!steps.length) return;
    setBusy(true);
    try {
      for (const step of steps) {
        await api.post(`/inventory/items/${step.itemId}/adjust`, { newCount: step.newCount, reason: reason.trim() });
      }
      toast.success(`Adjusted ${steps.length} item${steps.length > 1 ? 's' : ''}.`);
      void qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setRows([]);
      setReason('');
      onClose();
    } catch (e) {
      toast.apiError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Voice stock count">
      <div className="space-y-3">
        <VoiceInput<AdjustResponse>
          mode="extraction"
          endpoint="/inventory/dictate/adjust"
          placement="sheet"
          label="Speak corrected counts"
          hint="“Gloves are actually 40, burs 12 — quarterly count”"
          autoStart={open && rows.length === 0}
          onExtraction={({ extraction }) => {
            setRows(extraction.items.map((it) => ({ ...it, skipped: false })));
            if (extraction.reason) setReason(extraction.reason);
            if (extraction.clarifications.length) toast.info(extraction.clarifications.join(' '));
          }}
        />
        {rows.map((row, i) => (
          <RowShell key={i} skipped={!!row.skipped} onSkip={() => patch(i, { skipped: !row.skipped })}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold capitalize text-ink">{row.name}</span>
              <MatchChip match={row.match} />
            </div>
            <label className="block text-xs text-text-muted">
              Corrected count
              <Input type="number" inputMode="numeric" value={row.newCount} onChange={(e) => patch(i, { newCount: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            {row.match ? <p className="text-xs text-text-muted">Currently {row.match.currentStock}</p> : <p className="text-xs text-text-muted">Not in your catalog.</p>}
          </RowShell>
        ))}
        {rows.length ? (
          <>
            <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button className="w-full" onClick={apply} loading={busy}>
              Apply adjustments
            </Button>
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
