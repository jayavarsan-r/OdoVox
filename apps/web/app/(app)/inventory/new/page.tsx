'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast';
import { useCreateInventoryItem, useInventoryCategories } from '@/lib/inventory-queries';

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-subtle">{label}</span>
      {children}
    </label>
  );
}

export default function NewInventoryItemPage() {
  const router = useRouter();
  const toast = useToast();
  const categories = useInventoryCategories();
  const create = useCreateInventoryItem();

  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('piece');
  const [reorder, setReorder] = useState('0');
  const [sku, setSku] = useState('');
  const [vendorName, setVendorName] = useState('');

  async function save() {
    if (!categoryId || !name.trim()) {
      toast.error('Pick a category and name');
      return;
    }
    try {
      const item = await create.mutateAsync({
        categoryId,
        name,
        unitOfMeasure: unit || 'piece',
        reorderLevel: Number(reorder) || 0,
        sku: sku || undefined,
        vendorName: vendorName || undefined,
      });
      toast.success('Item created');
      router.replace(`/inventory/${item.id}`);
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">New item</h1>
      </div>

      <Field label="Category">
        <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Select a category</option>
          {categories.data?.items
            .filter((c) => !c.isArchived)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Unit of measure">
        <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="piece, box, ml, carpule" />
      </Field>
      <Field label="Reorder level">
        <input className={inputCls} inputMode="numeric" value={reorder} onChange={(e) => setReorder(e.target.value)} />
      </Field>
      <Field label="SKU (optional)">
        <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} />
      </Field>
      <Field label="Vendor (optional)">
        <input className={inputCls} value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
      </Field>

      <p className="text-xs text-text-subtle">New items start at 0 stock — record a purchase to add stock.</p>
      <Button disabled={create.isPending} onClick={save}>
        Create item
      </Button>
    </AnimatedPage>
  );
}
