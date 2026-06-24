import type { Redis } from 'ioredis';

/**
 * Ephemeral "doctor is recording into this visit" presence, tracked as a Redis set per clinic so a
 * reconnecting client's snapshot reflects current recording state. A short TTL guards against a
 * crashed worker pinning a visit as "recording" forever (the stop event normally clears it).
 */
const TTL_SECONDS = 600;
const key = (clinicId: string): string => `clinic:${clinicId}:recording`;

export async function markRecording(redis: Redis, clinicId: string, visitId: string): Promise<void> {
  await redis.sadd(key(clinicId), visitId);
  await redis.expire(key(clinicId), TTL_SECONDS);
}

export async function clearRecording(redis: Redis, clinicId: string, visitId: string): Promise<void> {
  await redis.srem(key(clinicId), visitId);
}

export async function getRecordingVisitIds(redis: Redis, clinicId: string): Promise<Set<string>> {
  const ids = await redis.smembers(key(clinicId));
  return new Set(ids);
}
