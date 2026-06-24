import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SILENCE,
  isSilent,
  normalizeForSearch,
  shouldAutoStop,
  singleShotReducer,
} from './single-shot.js';

describe('single-shot dictation — silence auto-stop', () => {
  it('treats low amplitudes as silence and loud ones as speech', () => {
    expect(isSilent([0.01, 0.02, 0.0, 0.03, 0.01])).toBe(true);
    expect(isSilent([0.01, 0.4, 0.02, 0.0, 0.0])).toBe(false);
  });

  it('auto-stops only after the configured silence window (1.5s)', () => {
    expect(shouldAutoStop(1400)).toBe(false);
    expect(shouldAutoStop(1500)).toBe(true);
    expect(shouldAutoStop(DEFAULT_SILENCE.silenceMs)).toBe(true);
  });
});

describe('single-shot dictation — transcript → search', () => {
  it('normalizes a transcript for the search box (trim + drop trailing punctuation)', () => {
    expect(normalizeForSearch('  Akhilesh Guhan.  ')).toBe('Akhilesh Guhan');
    expect(normalizeForSearch('tooth 26?')).toBe('tooth 26');
  });
});

describe('single-shot dictation — state machine', () => {
  it('idle → recording → processing → done(transcript)', () => {
    let s = singleShotReducer({ kind: 'idle' }, { type: 'START' });
    expect(s.kind).toBe('recording');
    s = singleShotReducer(s, { type: 'STOP' });
    expect(s.kind).toBe('processing');
    s = singleShotReducer(s, { type: 'RESULT', transcript: 'tooth 26' });
    expect(s).toEqual({ kind: 'done', transcript: 'tooth 26' });
  });

  it('any state → error on FAIL, and START resets to recording', () => {
    const failed = singleShotReducer({ kind: 'processing' }, { type: 'FAIL', error: 'no mic' });
    expect(failed).toEqual({ kind: 'error', error: 'no mic' });
    expect(singleShotReducer(failed, { type: 'START' }).kind).toBe('recording');
  });
});
