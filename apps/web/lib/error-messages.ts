import { ApiError } from './api-client';

/**
 * Map any thrown error to a specific, helpful, user-facing message. Pure (no React/DOM) so
 * it can be unit-tested and reused by every error path via `useToast().apiError()`.
 *
 * The only generic fallback is "Something went wrong. Try again." — everything we can be
 * specific about, we are.
 */
export function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'OTP_COOLDOWN_ACTIVE') {
      const seconds = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      return seconds
        ? `Please wait ${seconds}s before requesting a new code.`
        : 'Please wait a moment before requesting a new code.';
    }
    if (
      err.status === 429 ||
      err.code === 'RATE_LIMITED' ||
      err.code === 'OTP_RATE_LIMITED' ||
      err.code === 'OTP_LOCKED'
    ) {
      return 'Too many attempts. Try again in a minute.';
    }
    if (err.code === 'OTP_INCORRECT') {
      const remaining = (err.details as { attemptsRemaining?: number } | undefined)?.attemptsRemaining;
      return typeof remaining === 'number'
        ? `Wrong code. ${remaining} attempts left.`
        : 'Wrong code. Please try again.';
    }
    if (err.code === 'INVALID_PHONE') {
      return 'Please enter a valid 10-digit Indian mobile number.';
    }
    if (err.code === 'VALIDATION_ERROR') {
      return 'Please check your details and try again.';
    }
    if (err.status >= 500 || err.code === 'INTERNAL_ERROR') {
      return 'Something went wrong. Try again.';
    }
    // A known 4xx with its own message (e.g. ALREADY_IN_CLINIC, NOT_FOUND).
    return err.message || 'Something went wrong. Try again.';
  }

  // Network failures (fetch rejects with a TypeError) and unknown errors.
  if (err instanceof Error && /fetch|network|load failed|connection/i.test(err.message)) {
    return "Can't reach Odovox. Check your connection.";
  }
  return 'Something went wrong. Try again.';
}
