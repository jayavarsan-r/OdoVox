'use client';

import { create } from 'zustand';
import type { ActivityItem, QueueSnapshot, ServerEvent } from '@odovox/types';
import {
  applyEvent as reduceEvent,
  emptyQueueState,
  hydrateState,
  seedActivity as seedActivityFn,
  type QueueState,
} from './reducer';
import type { RealtimeStatus } from '../realtime/status';

/**
 * The single client-side source of truth for the queue. Socket events dispatch through `applyEvent`
 * — components never mutate. Components subscribe to `state` (a new object only when it actually
 * changes) and derive their slices with the pure selectors in `./selectors`, which keeps Zustand
 * selectors stable (no new-array-every-render re-render storms).
 */
interface QueueStore {
  state: QueueState;
  status: RealtimeStatus;
  myDoctorId: string | null;
  hydrate: (snapshot: QueueSnapshot) => void;
  seedActivity: (items: ActivityItem[]) => void;
  applyEvent: (event: ServerEvent) => void;
  setStatus: (status: RealtimeStatus) => void;
  setMyDoctorId: (id: string | null) => void;
  reset: () => void;
}

export const useQueueStore = create<QueueStore>((set) => ({
  state: emptyQueueState(),
  status: 'disconnected',
  myDoctorId: null,
  hydrate: (snapshot) =>
    set((s) => ({ state: { ...hydrateState(snapshot), activity: s.state.activity } })),
  seedActivity: (items) => set((s) => ({ state: seedActivityFn(s.state, items) })),
  applyEvent: (event) => set((s) => ({ state: reduceEvent(s.state, event) })),
  setStatus: (status) => set({ status }),
  setMyDoctorId: (myDoctorId) => set({ myDoctorId }),
  reset: () => set({ state: emptyQueueState(), status: 'disconnected', myDoctorId: null }),
}));
