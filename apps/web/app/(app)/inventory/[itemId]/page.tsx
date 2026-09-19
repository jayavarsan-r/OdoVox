'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Minus, Plus, RotateCcw } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useInventoryItem, useInventoryMovement } from '@/lib/inventory-queries';
import { adjustError, consumeError, expiryWarning, movementKindLabel, signedQuantity, validatePurchase } from '@/lib/inventory-ui';
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

      {/*
        Frame 68's head: two tiles side by side, then the actions in one row.

        This was a centred stock number over a DETAILS list of five key/value rows — Category,
        SKU, Vendor, Last purchase, Batch/Expiry — most of them reading "—" on a real item.
        Five rows of nothing is worse than four rows of something: it makes an item look
        unrecorded when it is merely uncomplicated.

        So the facts that exist get a tile, and the ones that do not are simply absent.
      */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className={cn(
            'rounded-2xl p-4',
            item.isLowStock ? 'bg-warn-soft' : 'bg-white shadow-elev-1',
          )}
        >
          <p
            className={cn(
              'text-2xs font-heavy tracking-[0.06em]',
              item.isLowStock ? 'text-warn' : 'text-pine-3',
            )}
          >
            IN STOCK
          </p>
          <p
            className={cn(
              'mt-1 text-[26px] font-black leading-none tabular-nums',
              item.isLowStock ? 'text-warn' : 'text-pine',
            )}
          >
            {item.currentStock}
            <span className="ml-1.5 text-xs font-bold text-pine-3">{item.unitOfMeasure}</span>
          </p>
          {item.reorderLevel > 0 ? (
            <p
              className={cn(
                'mt-1.5 text-3xs font-heavy',
                item.isLowStock ? 'text-warn' : 'text-pine-3',
              )}
            >
              reorder @ {item.reorderLevel}
            </p>
          ) : null}
        </div>

        {/* Price / vendor / expiry. Rendered only when the item carries any of them. */}
        {item.lastPurchasePricePaise != null || item.vendorName || item.expiryDate ? (
          <div className="rounded-2xl bg-white p-4 shadow-elev-1">
            <p className="truncate text-2xs font-heavy tracking-[0.06em] text-pine-3">
              {[item.lastPurchasePricePaise != null ? '₹' : null, item.unitOfMeasure.toUpperCase(), item.vendorName ? 'VENDOR' : null]
                .filter(Boolean)
                .join(' / ')}
            </p>
            <p className="mt-1 truncate text-[15px] font-heavy text-pine">
              {[
                item.lastPurchasePricePaise != null ? rupees(item.lastPurchasePricePaise) : null,
                item.vendorName,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            {item.expiryDate ? (
              <p
                className={cn(
                  'mt-1.5 text-3xs font-heavy',
                  expiryWarning(item.expiryDate)?.expired ? 'text-crit' : 'text-pine-3',
                )}
              >
                Exp {fmt(item.expiryDate)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-4 shadow-elev-1">
            <p className="text-2xs font-heavy tracking-[0.06em] text-pine-3">CATEGORY</p>
            <p className="mt-1 truncate text-[15px] font-heavy text-pine">
              {item.categoryName ?? '—'}
            </p>
          </div>
        )}
      </div>

      {/*
        SKU and batch, only when the item carries them. The old DETAILS list showed a row for
        each whether or not there was anything in it; dropping the list entirely would have
        taken these with it, which for an item that HAS a SKU is losing a fact, not tidying
        one away. So they render here as one quiet line, and nothing renders when there is
        nothing to say.
      */}
      {item.sku || item.batchNumber ? (
        <p className="px-1 text-xs font-semibold text-pine-3">
          {[item.sku ? `SKU ${item.sku}` : null, item.batchNumber ? `Batch ${item.batchNumber}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}

      {/* Purchase, Consume, and — for an admin — the stock-count reset, as the frame's small
          circle rather than a third full-width button competing with the two real verbs. */}
      <div className="flex items-center gap-2.5">
        <Button className="flex-1" onClick={() => openSheet('purchase')}>
          <Plus className="size-4" /> Purchase
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => openSheet('consume')}>
          <Minus className="size-4" /> Consume
        </Button>
        {isAdmin ? (
          <button
            type="button"
            aria-label="Adjust by stock count"
            onClick={() => openSheet('adjust')}
            className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-hair-2 bg-white text-pine active:bg-[rgba(31,42,35,0.03)]"
          >
            <RotateCcw className="size-4" />
          </button>
        ) : null}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Recent movements</h2>
        {item.recentMovements && item.recentMovements.length > 0 ? (
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {item.recentMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-[15px] py-3 text-sm">
                {/* What happened on the left, what it did to the count on the right — the
                    column you scan down when you are asking "where did it all go". */}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-pine-3">
                  {movementKindLabel[m.kind]}
                  {m.procedureName ? ` · ${m.procedureName}` : ''}
                </span>
                <span className="shrink-0 text-[13px] font-heavy tabular-nums">
                  <span className={cn(m.quantity >= 0 ? 'text-live' : 'text-crit')}>
                    {signedQuantity(m.quantity)}
                  </span>
                  <span className="text-pine-3"> · {fmt(m.createdAt)}</span>
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
