'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useInventoryItem, useInventoryMovement } from '@/lib/inventory-queries';
import { adjustError, consumeError, movementKindLabel, signedQuantity, validatePurchase } from '@/lib/inventory-ui';
import { rupees } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';

const inputCls = 'w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong';

type SheetKind = 'purchase' | 'consume' | 'adjust' | null;

function fmt(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function InventoryItemPage() {
  const router = useRouter();
  const { itemId } = useParams<{ itemId: string }>();
  const toast = useToast();
  const isAdmin = useAuth((s) => s.activeMembership?.isAdmin ?? false);
  const { data: item, isLoading } = useInventoryItem(itemId);
  const movement = useInventoryMovement(itemId);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [procedure, setProcedure] = useState('');

  if (isLoading || !item) {
    return <AnimatedPage className="flex flex-1 items-center justify-center px-5">Loading…</AnimatedPage>;
  }

  function openSheet(kind: SheetKind) {
    setQty('');
    setPrice('');
    setReason('');
    setProcedure('');
    setSheet(kind);
  }

  async function submit() {
    if (!item) return;
    const n = Number(qty);
    try {
      if (sheet === 'purchase') {
        const v = validatePurchase({ quantity: n, pricePerUnitPaise: Math.round(Number(price) * 100) });
        if (!v.valid) {
          toast.error('Enter quantity and price');
          return;
        }
        await movement.mutateAsync({ action: 'purchase', body: { quantity: n, pricePerUnitPaise: Math.round(Number(price) * 100) } });
        toast.success('Stock added');
      } else if (sheet === 'consume') {
        const err = consumeError(n, item.currentStock);
        if (err) {
          toast.error(err);
          return;
        }
        await movement.mutateAsync({ action: 'consume', body: { quantity: n, procedureName: procedure || undefined } });
        toast.success('Stock consumed');
      } else if (sheet === 'adjust') {
        const err = adjustError(reason);
        if (err) {
          toast.error(err);
          return;
        }
        await movement.mutateAsync({ action: 'adjust', body: { newCount: n, reason } });
        toast.success('Stock adjusted');
      }
      setSheet(null);
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="truncate text-lg font-semibold">{item.name}</h1>
      </div>

      {/* STOCK CARD */}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-5 shadow-elev-1">
        <span className="text-4xl font-bold">{item.currentStock}</span>
        <span className="text-xs text-text-subtle">{item.unitOfMeasure}</span>
        {item.isLowStock ? <span className="text-xs font-medium text-danger">Below reorder: {item.reorderLevel}</span> : null}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => openSheet('purchase')}>
            <Plus className="size-4" /> Purchase
          </Button>
          <Button size="sm" variant="outline" onClick={() => openSheet('consume')}>
            <Minus className="size-4" /> Consume
          </Button>
          {isAdmin ? (
            <Button size="sm" variant="ghost" onClick={() => openSheet('adjust')}>
              <SlidersHorizontal className="size-4" /> Adjust
            </Button>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Details</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-text-subtle">Category</dt>
          <dd>{item.categoryName ?? '—'}</dd>
          <dt className="text-text-subtle">SKU</dt>
          <dd>{item.sku ?? '—'}</dd>
          <dt className="text-text-subtle">Vendor</dt>
          <dd>{item.vendorName ?? '—'}</dd>
          <dt className="text-text-subtle">Last purchase</dt>
          <dd>{item.lastPurchaseDate ? `${fmt(item.lastPurchaseDate)} · ${item.lastPurchasePricePaise != null ? rupees(item.lastPurchasePricePaise) : '—'}` : '—'}</dd>
          <dt className="text-text-subtle">Batch / Expiry</dt>
          <dd>{item.batchNumber ?? '—'}{item.expiryDate ? ` · ${fmt(item.expiryDate)}` : ''}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Recent movements</h2>
        {item.recentMovements && item.recentMovements.length > 0 ? (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {item.recentMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn('font-semibold', m.quantity >= 0 ? 'text-sage-deep' : 'text-danger')}>{signedQuantity(m.quantity)}</span>
                  <span className="text-text-subtle">{movementKindLabel[m.kind]}</span>
                  {m.procedureName ? <span className="text-xs text-muted-foreground">· {m.procedureName}</span> : null}
                </span>
                <span className="text-xs text-text-subtle">
                  {fmt(m.createdAt)}
                  {m.totalPricePaise != null ? ` · ${rupees(m.totalPricePaise)}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-paper-warm p-3 text-sm text-text-subtle">No movements yet.</p>
        )}
      </section>

      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'purchase' ? 'Record purchase' : sheet === 'consume' ? 'Consume stock' : 'Adjust stock'}
      >
        <div className="flex flex-col gap-3 p-5">
          {sheet === 'adjust' ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-subtle">New count</span>
                <input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-subtle">Reason (required)</span>
                <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-subtle">Quantity</span>
                <input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              {sheet === 'purchase' ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-subtle">Price per unit (₹)</span>
                  <input className={inputCls} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-subtle">Procedure (optional)</span>
                  <input className={inputCls} value={procedure} onChange={(e) => setProcedure(e.target.value)} />
                </label>
              )}
            </>
          )}
          <Button disabled={movement.isPending} onClick={submit}>
            Confirm
          </Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
