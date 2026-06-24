'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ActivityItem,
  CallInInput,
  CancelVisitInput,
  CheckInInput,
  CheckoutInput,
  CompleteVisitInput,
  CreateWalkInInput,
  PriorityInput,
  QueueSnapshot,
  ReassignInput,
  ReturnToQueueInput,
  VisitWithPatient,
} from '@odovox/types';
import { api } from '../api-client';
import { useQueueStore } from './store';

/**
 * The queue command layer. Every mutation just fires the REST call — the store is updated by the
 * broadcast that the server emits after committing (so a tab that issued the action and a tab that
 * merely watched both converge through the exact same event path). No optimistic store writes.
 */

/** Initial hydrate over REST so the page paints immediately; the socket then keeps it live. */
export function useQueueSnapshot(filter: 'me' | 'all') {
  const hydrate = useQueueStore((s) => s.hydrate);
  return useQuery({
    queryKey: ['queue', filter],
    queryFn: async () => {
      const snap = await api.get<QueueSnapshot>(`/queue?doctor=${filter}`);
      hydrate(snap);
      return snap;
    },
    staleTime: 5_000,
  });
}

/** Seed the activity feed from REST; live `activity` events prepend on top in the store. */
export function useActivityFeed(enabled: boolean) {
  const seed = useQueueStore((s) => s.seedActivity);
  return useQuery({
    queryKey: ['queue-activity'],
    enabled,
    queryFn: async () => {
      const { items } = await api.get<{ items: ActivityItem[] }>('/activity');
      seed(items);
      return items;
    },
  });
}

interface CallInResult {
  visit: VisitWithPatient;
  autoCheckedOut: VisitWithPatient | null;
}

/** Record findings: ensure a consultation exists for the in-chair visit, then open it (Phase 3). */
export function useStartConsultation() {
  return useMutation({
    mutationFn: ({ patientId, visitId }: { patientId: string; visitId: string }) =>
      api.post<{ consultationId: string; visitId: string }>('/consultations', { patientId, visitId }),
  });
}

export function useWalkIn() {
  return useMutation({ mutationFn: (body: CreateWalkInInput) => api.post<VisitWithPatient>('/visits', body) });
}

export function useCheckIn() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CheckInInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/check-in`, body),
  });
}

export function useCallIn() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: CallInInput }) =>
      api.post<CallInResult>(`/visits/${id}/call-in`, body ?? {}),
  });
}

export function useReturnToQueue() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: ReturnToQueueInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/return-to-queue`, body ?? {}),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: CheckoutInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/checkout`, body ?? {}),
  });
}

export function useCompleteVisit() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompleteVisitInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/complete`, body),
  });
}

export function useCancelVisit() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CancelVisitInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/cancel`, body),
  });
}

export function useReassign() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReassignInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/reassign`, body),
  });
}

export function usePriority() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PriorityInput }) =>
      api.post<VisitWithPatient>(`/visits/${id}/priority`, body),
  });
}
