'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import type {
  AdjustInput,
  ConsumeInput,
  CreateInventoryCategoryInput,
  CreateInventoryItemInput,
  InventoryCategoryResponse,
  InventoryItemResponse,
  InventoryItemSummary,
  PurchaseInput,
} from '@odovox/types';

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ItemFilters {
  category?: string;
  search?: string;
  lowStockOnly?: boolean;
}

export function useInventoryItems(filters: ItemFilters) {
  return useInfiniteQuery({
    queryKey: ['inventory-items', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (filters.category) params.set('category', filters.category);
      if (filters.search) params.set('search', filters.search);
      if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
      if (pageParam) params.set('cursor', pageParam);
      return api.get<Paginated<InventoryItemSummary>>(`/inventory/items?${params.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => api.get<InventoryItemResponse>(`/inventory/items/${id}`),
    enabled: !!id,
  });
}

export function useInventoryCategories() {
  return useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get<{ items: InventoryCategoryResponse[] }>('/inventory/categories'),
  });
}

export function useCreateInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInventoryCategoryInput) =>
      api.post<InventoryCategoryResponse>('/inventory/categories', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-categories'] }),
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInventoryItemInput) => api.post<InventoryItemResponse>('/inventory/items', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-items'] }),
  });
}

type MovementBody = PurchaseInput | ConsumeInput | AdjustInput | { quantity: number; reason?: string };

/** Run a stock movement (purchase/consume/adjust/dispose-expired) against an item. */
export function useInventoryMovement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body }: { action: 'purchase' | 'consume' | 'adjust' | 'dispose-expired'; body: MovementBody }) =>
      api.post<InventoryItemSummary>(`/inventory/items/${id}/${action}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-item', id] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['needs-you'] });
    },
  });
}
