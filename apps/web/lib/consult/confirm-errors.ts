import type { SafetyWarning } from './safety-view.js';

/**
 * Pull the server's blocking errors out of a failed confirm. The confirm endpoint 422s with
 * `{ code: 'BLOCKING_ERRORS', details: { blockingErrors: SafetyWarning[] } }` when safety re-runs
 * on the final edited data and finds a gate (invalid tooth, allergy conflict, …). Those errors must
 * flow back into the state machine — not be thrown — so the verification card can render them
 * inline. Duck-typed rather than `instanceof ApiError` so it stays a pure, node-testable module.
 */
export function blockingErrorsFromError(err: unknown): SafetyWarning[] | null {
  if (!(err instanceof Error)) return null;
  const { code, details } = err as Error & { code?: unknown; details?: unknown };
  if (code !== 'BLOCKING_ERRORS') return null;
  const list = (details as { blockingErrors?: unknown } | undefined)?.blockingErrors;
  if (!Array.isArray(list)) return null;
  const errors = list.filter(
    (item): item is SafetyWarning =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as { code?: unknown }).code === 'string' &&
      typeof (item as { message?: unknown }).message === 'string',
  );
  return errors.length > 0 ? errors : null;
}
