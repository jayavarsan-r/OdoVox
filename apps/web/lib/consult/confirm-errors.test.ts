import { describe, expect, it } from 'vitest';
import { blockingErrorsFromError } from './confirm-errors.js';

/**
 * Regression (Phase 9.5 P0.2): confirm() used to rethrow the 422 BLOCKING_ERRORS ApiError, which
 * escaped `void confirm()` in the verification card as an unhandled rejection (the crash the user
 * saw). The store now routes the server's blocking errors back into the state machine via this
 * extractor instead of throwing. Duck-typed on { code, details } so it works on any ApiError-shaped
 * error without importing browser-coupled modules.
 */

function apiError(code: string, details?: unknown): Error {
  return Object.assign(new Error('Resolve blocking errors before confirming'), {
    name: 'ApiError',
    status: 422,
    code,
    details,
  });
}

describe('blockingErrorsFromError', () => {
  it('extracts the blockingErrors array from a BLOCKING_ERRORS ApiError', () => {
    const errors = [
      { code: 'invalid_tooth', message: 'Tooth 19 is not a valid FDI number', field: 'teeth', detail: '19' },
    ];
    expect(blockingErrorsFromError(apiError('BLOCKING_ERRORS', { blockingErrors: errors }))).toEqual(errors);
  });

  it('returns null for other API errors (they still fail loudly)', () => {
    expect(blockingErrorsFromError(apiError('INTERNAL_ERROR'))).toBeNull();
    expect(blockingErrorsFromError(new Error('network down'))).toBeNull();
    expect(blockingErrorsFromError(null)).toBeNull();
  });

  it('returns null when the details payload is malformed', () => {
    expect(blockingErrorsFromError(apiError('BLOCKING_ERRORS'))).toBeNull();
    expect(blockingErrorsFromError(apiError('BLOCKING_ERRORS', { blockingErrors: 'nope' }))).toBeNull();
    expect(blockingErrorsFromError(apiError('BLOCKING_ERRORS', { blockingErrors: [] }))).toBeNull();
  });
});
