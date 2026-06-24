import type { Redis } from 'ioredis';

/**
 * Pipeline events surfaced to the doctor over SSE. The transport is Redis (a list for resume +
 * pub/sub for live delivery) so workers can publish across a future process boundary (Phase 10).
 */
export type ConsultationEventType =
  | 'RECORDED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'EXTRACTING'
  | 'READY'
  | 'FAILED';

export interface ConsultationEvent {
  type: ConsultationEventType;
  data?: unknown;
}

const listKey = (id: string) => `consult:log:${id}`;
const channelKey = (id: string) => `consult:chan:${id}`;
const TTL_SECONDS = 60 * 60; // 1h — well past a consultation's lifetime.

/**
 * Append an event to the consultation's Redis log (for `?since` resume) and publish it live.
 * Returns the event's 1-based id (its position in the log), used as the SSE `id:` / Last-Event-ID.
 */
export async function publishConsultationEvent(
  redis: Redis,
  consultationId: string,
  event: ConsultationEvent,
): Promise<number> {
  const id = await redis.rpush(listKey(consultationId), JSON.stringify(event));
  await redis.expire(listKey(consultationId), TTL_SECONDS);
  await redis.publish(channelKey(consultationId), JSON.stringify({ id, event }));
  return id;
}

/** Replay events with id > `since` (0 = from the start) — used on SSE (re)connect. */
export async function getConsultationEventsSince(
  redis: Redis,
  consultationId: string,
  since: number,
): Promise<{ id: number; event: ConsultationEvent }[]> {
  const items = await redis.lrange(listKey(consultationId), since, -1);
  return items.map((raw, i) => ({ id: since + i + 1, event: JSON.parse(raw) as ConsultationEvent }));
}

export const consultationChannel = channelKey;
