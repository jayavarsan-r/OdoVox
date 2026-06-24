import { describe, expect, it } from 'vitest';
import { callInInitial, callInReducer, isCallingIn } from './call-in-machine';

describe('call-in UI state machine', () => {
  it('idle → loading → success', () => {
    let s = callInReducer(callInInitial, { type: 'START', visitId: 'v1' });
    expect(s).toEqual({ kind: 'loading', visitId: 'v1' });
    expect(isCallingIn(s, 'v1')).toBe(true);
    s = callInReducer(s, { type: 'OK', visitId: 'v1' });
    expect(s).toEqual({ kind: 'success', visitId: 'v1' });
  });

  it('loading → error with a friendly STALE_VERSION message', () => {
    let s = callInReducer(callInInitial, { type: 'START', visitId: 'v1' });
    s = callInReducer(s, { type: 'FAIL', visitId: 'v1', code: 'STALE_VERSION' });
    expect(s).toMatchObject({ kind: 'error', visitId: 'v1' });
    if (s.kind === 'error') expect(s.message).toMatch(/already moved/i);
  });

  it('ignores a double-tap (START while loading)', () => {
    let s = callInReducer(callInInitial, { type: 'START', visitId: 'v1' });
    s = callInReducer(s, { type: 'START', visitId: 'v2' });
    expect(s).toEqual({ kind: 'loading', visitId: 'v1' }); // still the first
  });

  it('ignores OK/FAIL for a non-matching visit', () => {
    const loading = callInReducer(callInInitial, { type: 'START', visitId: 'v1' });
    expect(callInReducer(loading, { type: 'OK', visitId: 'other' })).toBe(loading);
  });

  it('RESET returns to idle', () => {
    const s = callInReducer({ kind: 'success', visitId: 'v1' }, { type: 'RESET' });
    expect(s).toEqual({ kind: 'idle' });
  });
});
