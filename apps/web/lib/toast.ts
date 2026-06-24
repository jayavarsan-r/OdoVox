'use client';

import { toast as sonnerToast } from 'sonner';
import { apiErrorToMessage } from './error-messages';

/**
 * The single toast entry point for the whole app. Wraps sonner so callers never import it
 * directly, and gives us one place to route API errors through `apiErrorToMessage`.
 *
 * Toasts render as a fixed overlay (configured on <Toaster/> in providers.tsx: top-center,
 * offset for the safe-area, 5s auto-dismiss) so they never push content.
 */
export function useToast() {
  return {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast(message),
    /** Show the mapped, user-friendly message for any thrown error. */
    apiError: (err: unknown) => sonnerToast.error(apiErrorToMessage(err)),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  };
}
