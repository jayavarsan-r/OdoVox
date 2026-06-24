/**
 * Tiny UI state machine for the "Call in" tap: idle → loading → success | error. At most one call-in
 * is in flight; OK/FAIL only resolve the loading visit. The error copy translates the server's
 * machine code into something a doctor reads at a glance (the optimistic-lock loser sees "already
 * moved").
 */
export type CallInStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; visitId: string }
  | { kind: 'success'; visitId: string }
  | { kind: 'error'; visitId: string; message: string };

export type CallInAction =
  | { type: 'START'; visitId: string }
  | { type: 'OK'; visitId: string }
  | { type: 'FAIL'; visitId: string; code?: string }
  | { type: 'RESET' };

export const callInInitial: CallInStatus = { kind: 'idle' };

export function callInErrorMessage(code?: string): string {
  switch (code) {
    case 'STALE_VERSION':
      return 'Someone else already moved this patient';
    case 'INVALID_TRANSITION':
      return 'This patient can’t be called in right now';
    case 'FORBIDDEN':
      return 'This patient is in another doctor’s queue';
    default:
      return 'Couldn’t call the patient in. Try again.';
  }
}

export function callInReducer(state: CallInStatus, action: CallInAction): CallInStatus {
  switch (action.type) {
    case 'START':
      if (state.kind === 'loading') return state; // ignore double-taps while one is in flight
      return { kind: 'loading', visitId: action.visitId };
    case 'OK':
      return state.kind === 'loading' && state.visitId === action.visitId
        ? { kind: 'success', visitId: action.visitId }
        : state;
    case 'FAIL':
      return state.kind === 'loading' && state.visitId === action.visitId
        ? { kind: 'error', visitId: action.visitId, message: callInErrorMessage(action.code) }
        : state;
    case 'RESET':
      return callInInitial;
    default:
      return state;
  }
}

export function isCallingIn(state: CallInStatus, visitId: string): boolean {
  return state.kind === 'loading' && state.visitId === visitId;
}
