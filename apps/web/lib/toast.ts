"use client";

import { toast as sonnerToast } from "sonner";
import { apiErrorToMessage } from "./error-messages";
import { toastDuration } from "./ds/toast-voice";

/**
 * The single toast entry point for the whole app. Wraps sonner so callers never import
 * it directly, and gives us one place to route API errors through `apiErrorToMessage`.
 *
 * v9 frame 79 defines exactly THREE voices, and the distinction is behavioural:
 *
 *   success — 4s, auto-dismiss. Carries Undo wherever the action is reversible, and
 *             then lives the full 6s undo window so the affordance is reachable.
 *   problem — sticky until acted on, with Retry. Never blocks the screen.
 *   offline — persistent and calm. A state, not an event.
 *
 * One at a time, bottom-anchored above the nav, newest wins (configured on <Toaster/>
 * in providers.tsx).
 */

interface UndoOptions {
  /** Adds the Undo affordance and extends the toast to the full undo window. */
  undo?: () => void;
  description?: string;
}

interface RetryOptions {
  retry?: () => void;
  description?: string;
}

export function useToast() {
  return {
    /**
     * Success. Pass `undo` for any reversible action — saves, payments, swaps,
     * follow-up completions. The spec's rule is "undo everywhere".
     */
    success: (message: string, opts: UndoOptions = {}) =>
      sonnerToast.success(message, {
        description: opts.description,
        duration: toastDuration("success", Boolean(opts.undo)),
        action: opts.undo ? { label: "Undo", onClick: opts.undo } : undefined,
      }),

    /** Problem. Sticky until the user acts — pass `retry` when the action can be retried. */
    problem: (message: string, opts: RetryOptions = {}) =>
      sonnerToast.error(message, {
        description: opts.description,
        duration: toastDuration("problem"),
        action: opts.retry
          ? { label: "Retry", onClick: opts.retry }
          : undefined,
      }),

    /** Offline. Persistent, calm, no action. */
    offline: (message: string, description?: string) =>
      sonnerToast(message, { description, duration: toastDuration("offline") }),

    /**
     * Legacy alias for `problem` without a retry. Kept so the 34 existing call sites
     * keep working; new code should call `problem` and supply a retry where one exists.
     */
    error: (message: string) =>
      sonnerToast.error(message, { duration: toastDuration("problem") }),

    info: (message: string) => sonnerToast(message),

    /** Show the mapped, user-friendly message for any thrown error. */
    apiError: (err: unknown, retry?: () => void) =>
      sonnerToast.error(apiErrorToMessage(err), {
        duration: toastDuration("problem"),
        action: retry ? { label: "Retry", onClick: retry } : undefined,
      }),

    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  };
}
