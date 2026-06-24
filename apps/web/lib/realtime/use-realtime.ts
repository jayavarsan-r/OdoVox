'use client';

import { useEffect } from 'react';
import type { QueueSnapshot } from '@odovox/types';
import { api, refreshAccessToken } from '../api-client';
import { useAuth } from '../auth';
import { useQueueStore } from '../queue/store';
import { realtime } from './socket';

/**
 * App-wide realtime wiring. Mounted once in the authenticated shell. Connects the socket when authed,
 * pipes every server event + status change into the queue store, reconciles on tab focus / phone
 * unlock (§5.2), and tears down on logout/unmount. The access token is read fresh on each reconnect
 * (the socket client's auth callback), so 15-min rotations don't force a reconnect.
 */
export function useRealtime(): { status: ReturnType<typeof useQueueStore.getState>['status'] } {
  const authed = useAuth((s) => !!s.accessToken && !!s.activeMembership);
  const membershipId = useAuth((s) => s.activeMembership?.id ?? null);

  useEffect(() => {
    if (!authed) return;
    const membership = useAuth.getState().activeMembership;
    useQueueStore.getState().setMyDoctorId(membership?.role === 'DOCTOR' ? membership.userId : null);

    const offEvent = realtime.onEvent((event) => useQueueStore.getState().applyEvent(event));
    const offStatus = realtime.onStatus((status) => useQueueStore.getState().setStatus(status));
    realtime.connect(
      () => useAuth.getState().accessToken,
      async () => {
        await refreshAccessToken();
      },
    );

    // Phone lock → unlock (or tab refocus): pull a fresh snapshot over REST so the UI is correct
    // within ~2s even before the socket finishes reconnecting in the background.
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      void api
        .get<QueueSnapshot>('/queue?doctor=all')
        .then((snap) => useQueueStore.getState().hydrate(snap))
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      offEvent();
      offStatus();
      document.removeEventListener('visibilitychange', onVisible);
      realtime.disconnect();
    };
  }, [authed, membershipId]);

  const status = useQueueStore((s) => s.status);
  return { status };
}
