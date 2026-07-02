import { ForbiddenError } from '../errors.js';
import { storage } from '../storage.js';
import { getSttProvider } from '../stt/index.js';
import type { SttLogger } from '../stt/index.js';

/**
 * Shared short-clip dictation plumbing (Phase 9.7). Every dictate endpoint — in routes/dictate.ts
 * and the domain routes that host their own (appointments, lab) — goes through these two helpers,
 * so the clinic-scoping check and the transient-audio guarantee are identical everywhere.
 */

/** Reject a storage key that doesn't belong to the caller's clinic (no cross-clinic audio reads). */
export function assertOwnDictationKey(storageKey: string, clinicId: string): void {
  if (!storageKey.startsWith(`clinics/${clinicId}/dictation/`)) {
    throw new ForbiddenError('That audio key does not belong to your clinic');
  }
}

/** Download → transcribe → delete (best-effort). The audio is transient — never persisted. */
export async function transcribeAndPurgeDictation(storageKey: string, logger?: SttLogger): Promise<string> {
  const audio = await storage.getObject(storageKey);
  const result = await getSttProvider(logger).transcribe(audio, { language: 'auto', mimeType: 'audio/webm' });
  await storage.deleteObject(storageKey).catch(() => undefined);
  return result.transcript;
}
