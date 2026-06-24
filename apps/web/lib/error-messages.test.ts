import { describe, expect, it } from 'vitest';
import { apiErrorToMessage } from './error-messages';
import { ApiError } from './api-client';

describe('apiErrorToMessage', () => {
  it('maps OTP_COOLDOWN_ACTIVE with the retry seconds', () => {
    const err = new ApiError(429, 'OTP_COOLDOWN_ACTIVE', 'wait', { retryAfterSeconds: 27 });
    expect(apiErrorToMessage(err)).toBe('Please wait 27s before requesting a new code.');
  });

  it('maps any 429 / rate-limit to the throttle message', () => {
    expect(apiErrorToMessage(new ApiError(429, 'OTP_RATE_LIMITED', 'x'))).toBe(
      'Too many attempts. Try again in a minute.',
    );
    expect(apiErrorToMessage(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe(
      'Too many attempts. Try again in a minute.',
    );
  });

  it('maps validation errors to a check-your-details message', () => {
    expect(apiErrorToMessage(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe(
      'Please check your details and try again.',
    );
  });

  it('maps 500 / unknown to the only generic fallback', () => {
    expect(apiErrorToMessage(new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(
      'Something went wrong. Try again.',
    );
    expect(apiErrorToMessage('not an error')).toBe('Something went wrong. Try again.');
  });

  it('maps a fetch/network failure to a connection message', () => {
    expect(apiErrorToMessage(new TypeError('Failed to fetch'))).toBe(
      "Can't reach Odovox. Check your connection.",
    );
  });

  it('passes through a specific 4xx message (e.g. already in a clinic)', () => {
    expect(apiErrorToMessage(new ApiError(409, 'ALREADY_IN_CLINIC', 'You already belong to a clinic.'))).toBe(
      'You already belong to a clinic.',
    );
  });
});
