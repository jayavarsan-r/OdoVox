'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Tags } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { useCreateInventoryCategory, useInventoryCategories } from '@/lib/inventory-queries';

const inputCls = 'w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong';

export default function InventoryCategoriesPage() {
  const router = useRouter();
  const toast = useToast();
  const categories = useInventoryCategories();
  const create = useCreateInventoryCategory();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [iconName, setIconName] = useState('');

  async function submit() {
    if (!name.trim()) {
      toast.error('Enter a name');
      return;
    }
    try {
      await create.mutateAsync({ name, iconName: iconName || undefined, sortOrder: categories.data?.items.length ?? 0 });
      toast.success('Category added');
      setOpen(false);
      setName('');
      setIconName('');
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
        <h1 className="text-lg font-semibold">Categories</h1>
      </div>

      {categories.data?.items.length === 0 ? (
        <EmptyState variant="inline" icon={<Tags className="size-5" />} title="No categories" body="Group your stock — Consumables, Anaesthetics, Instruments…" />
      ) : (
        <div className="flex flex-col gap-2">
          {categories.data?.items.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 shadow-elev-1">
              <span className="text-sm font-medium">
                {c.name}
                {c.isArchived ? <span className="ml-2 text-xs text-text-subtle">Archived</span> : null}
              </span>
              <span className="text-xs text-text-subtle">{c.itemCount ?? 0} items</span>
            </div>
          ))}
        </div>
      )}

      <Button className="self-start" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add category
      </Button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New category">
        <div className="flex flex-col gap-3 p-5">
          <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Lucide icon name (optional, e.g. syringe)" value={iconName} onChange={(e) => setIconName(e.target.value)} />
          <Button disabled={create.isPending} onClick={submit}>
            Save category
          </Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
