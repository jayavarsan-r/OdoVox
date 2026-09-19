import { describe, expect, it } from 'vitest';
import { retryActionFor } from './retry';

/**
 * Frame 26's "Try again" used to mean one thing: re-upload the recording. These decide when
 * it should mean something cheaper, because the audio is already on the server.
 */
describe('retryActionFor', () => {
  it('re-uploads when the upload itself failed — the device holds the only copy', () => {
    expect(retryActionFor('upload')).toBe('reupload');
  });

  it('re-uploads after a permission failure, where nothing was ever sent', () => {
    expect(retryActionFor('permission')).toBe('reupload');
  });

  it('re-runs STT when transcription failed, instead of re-sending the audio', () => {
    // The whole point: four minutes of audio over the same bad signal that may have caused
    // the fault is the slowest possible retry.
    expect(retryActionFor('STT')).toBe('retranscribe');
    expect(retryActionFor('transcription')).toBe('retranscribe');
  });

  it('re-runs extraction when extraction failed, keeping the transcript', () => {
    expect(retryActionFor('EXTRACTION')).toBe('reextract');
    expect(retryActionFor('extraction')).toBe('reextract');
  });

  it('falls back to re-running STT for an unrecognised SERVER stage', () => {
    // Re-running STT re-enqueues extraction after it, so it recovers the whole server-side
    // pipeline. By the time a failure has a server stage at all, the audio is stored.
    expect(retryActionFor('pipeline')).toBe('retranscribe');
    expect(retryActionFor('something-new')).toBe('retranscribe');
  });

  it('re-uploads when there is no step at all', () => {
    // No step means we never got far enough to know, so assume nothing reached the server.
    expect(retryActionFor(undefined)).toBe('reupload');
    expect(retryActionFor('')).toBe('reupload');
  });
});
