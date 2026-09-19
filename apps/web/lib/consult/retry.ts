/**
 * What "Try again" should actually do on frame 26.
 *
 * The failure screen offered one recovery: re-upload the recording from the device. That is
 * right when the UPLOAD is what failed, and wasteful when it is not — if the audio reached
 * the server and transcription fell over, re-sending four minutes of audio over the same bad
 * signal that may have caused the problem is the slowest possible way to retry, and it can
 * fail again for a reason unrelated to the original fault.
 *
 * The server has always had the cheaper recoveries — POST /consultations/:id/retranscribe
 * re-runs STT on the stored audio, /reextract re-runs extraction on the stored transcript —
 * and nothing called either of them. This picks the right one from the step the failure
 * carries.
 */

export type RetryAction = 'reupload' | 'retranscribe' | 'reextract';

/**
 * `step` comes from three places and is not a tidy enum:
 *   - 'upload' / 'permission', dispatched client-side;
 *   - an SSE stage string;
 *   - a Job.kind — 'STT' or 'EXTRACTION'.
 *
 * So it is matched loosely, and anything unrecognised falls back to `retranscribe` rather
 * than `reupload`. Re-running STT re-enqueues extraction after it, so it recovers the whole
 * server-side pipeline; and by the time a failure has a server stage at all, the audio is
 * stored. Guessing `reupload` for an unknown server fault would send the doctor back through
 * the slow path for nothing.
 */
export function retryActionFor(step: string | undefined): RetryAction {
  const s = (step ?? '').toLowerCase();

  // Nothing reached the server yet — the blob on the device is the only copy that matters.
  if (s === 'upload' || s === 'permission' || s === '') return 'reupload';

  if (s.includes('extract')) return 'reextract';
  if (s.includes('stt') || s.includes('transcri')) return 'retranscribe';

  return 'retranscribe';
}
