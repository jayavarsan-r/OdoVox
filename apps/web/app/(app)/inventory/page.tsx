'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes, ChevronRight, FolderPlus, PackagePlus } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FabMenu } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useInventoryCategories, useInventoryItems, type ItemFilters } from '@/lib/inventory-queries';
import { expiryWarning, reorderDeficitLabel, splitLowStock, stockBarClass, stockTone } from '@/lib/inventory-ui';
import type { InventoryItemSummary } from '@odovox/types';
import { cn } from '@/lib/utils';

function ItemCard({ item, onClick }: { item: InventoryItemSummary; onClick: () => void }) {
  const tone = stockTone(item);
  const exp = expiryWarning(item.expiryDate);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-surface text-left shadow-elev-1 transition-shadow active:shadow-elev-2"
    >
      <span className={cn('w-1 shrink-0', stockBarClass(tone))} />
      <span className="flex flex-1 flex-col gap-0.5 p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{item.name}</span>
          <span className="shrink-0 text-sm font-semibold">
            {item.currentStock}
            {item.reorderLevel > 0 && item.isLowStock ? <span className="text-text-subtle"> / {item.reorderLevel}</span> : null}{' '}
            <span className="text-xs font-normal text-text-subtle">{item.unitOfMeasure}</span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{item.categoryName ?? '—'}</span>
          {item.isLowStock ? (
            <span className="text-xs font-medium text-danger">{reorderDeficitLabel(item.currentStock, item.reorderLevel)}</span>
          ) : exp ? (
            <span className={cn('text-xs font-medium', exp.expired ? 'text-danger' : 'text-peach-deep')}>{exp.label}</span>
          ) : (
            <ChevronRight className="size-4 text-text-subtle" />
          )}
        </span>
      </span>
    </button>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const categories = useInventoryCategories();
  const filters: ItemFilters = { category, search: search || undefined, lowStockOnly: lowOnly || undefined };
  const query = useInventoryItems(filters);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const { low, rest } = splitLowStock(items);

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-28">
      <EditorialHeading title="Inventory" trailing={<ProfileButton />} />

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-border-strong"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(undefined)}
          className={cn('rounded-pill px-3 py-1.5 text-xs font-medium', !category ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle')}
        >
          All
        </button>
        {categories.data?.items
          .filter((c) => !c.isArchived)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn('rounded-pill px-3 py-1.5 text-xs font-medium', category === c.id ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle')}
            >
              {c.name}
            </button>
          ))}
        <button
          type="button"
          onClick={() => setLowOnly((v) => !v)}
          className={cn('rounded-pill px-3 py-1.5 text-xs font-medium', lowOnly ? 'bg-danger text-paper' : 'bg-paper-warm text-text-subtle')}
        >
          {lowOnly ? '✓ ' : ''}Low stock only
        </button>
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState variant="inline" icon={<Boxes className="size-5" />} title="No items yet" body="Add consumables, anaesthetics and instruments to track stock." />
      ) : (
        <>
          {low.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">Low stock · {low.length}</p>
              {low.map((i) => (
                <ItemCard key={i.id} item={i} onClick={() => router.push(`/inventory/${i.id}`)} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">All items · {rest.length}</p>
            {rest.map((i) => (
              <ItemCard key={i.id} item={i} onClick={() => router.push(`/inventory/${i.id}`)} />
            ))}
          </div>
        </>
      )}

      <FabMenu
        items={[
          { id: 'new-item', label: 'New item', tone: 'sage', icon: <PackagePlus />, onClick: () => router.push('/inventory/new') },
          { id: 'new-category', label: 'New category', tone: 'sky', icon: <FolderPlus />, onClick: () => router.push('/inventory/categories') },
        ]}
      />
    </AnimatedPage>
  );
}
