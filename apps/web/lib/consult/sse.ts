'use client';

import type { ConsultEvent } from './types';

/**
 * Fetch-based SSE reader. We can't use `EventSource` (it cannot send the Authorization header), so we
 * stream the response body and parse SSE frames ourselves. On any drop we call `onDrop` — the store
 * then refetches GET /consultations/:id and re-derives state, so reconnection is seamless (the
 * "if you can't resume cleanly, re-fetch via REST" strategy). Returns an abort function.
 */
export function openConsultStream(
  apiUrl: string,
  consultationId: string,
  token: string | null,
  onEvent: (event: ConsultEvent) => void,
  onDrop: () => void,
): () => void {
  const controller = new AbortController();
  let lastEventId = 0;
  let closed = false;

  const connect = async (): Promise<void> => {
    try {
      const res = await fetch(
        `${apiUrl}/consultations/${consultationId}/stream?since=${lastEventId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal },
      );
      if (!res.ok || !res.body) {
        if (!closed) onDrop();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          if (frame.startsWith(':')) continue; // heartbeat
          let id: number | null = null;
          let dataLine = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('id:')) id = Number(line.slice(3).trim());
            if (line.startsWith('data:')) dataLine += line.slice(5).trim();
          }
          if (id != null) lastEventId = id;
          if (!dataLine) continue;
          try {
            onEvent(JSON.parse(dataLine) as ConsultEvent);
          } catch {
            /* ignore malformed frame */
          }
        }
      }
      if (!closed) onDrop();
    } catch {
      if (!closed) onDrop();
    }
  };

  void connect();

  return () => {
    closed = true;
    controller.abort();
  };
}
