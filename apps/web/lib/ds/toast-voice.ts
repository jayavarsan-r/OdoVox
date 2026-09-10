/**
 * Toast voices (v9 frame 79).
 *
 * The spec allows exactly three, and the difference between them is *how long they
 * persist and what they demand*, not their colour:
 *
 *   success — auto-dismisses; the user need do nothing
 *   problem — STICKY until acted on; auto-dismissing an error hides a failure
 *   offline — persistent and calm; a state, not an event
 *
 * `Infinity` is sonner's sentinel for "never auto-dismiss".
 */
export type ToastVoice = "success" | "problem" | "offline";

/** Frame 79: "SUCCESS · 4 s". */
export const SUCCESS_MS = 4000;
/** `--duration-undo` — the 6s window the whole app gives reversible actions. */
export const UNDO_MS = 6000;

/**
 * How long a toast stays up.
 *
 * A success toast carrying an Undo lives for the full undo window, not the shorter
 * success duration: an undo the user cannot reach is not an undo. Problem and offline
 * never auto-dismiss — a failure that vanishes on its own is a failure nobody fixed.
 */
export function toastDuration(voice: ToastVoice, hasUndo = false): number {
  switch (voice) {
    case "success":
      return hasUndo ? UNDO_MS : SUCCESS_MS;
    case "problem":
    case "offline":
      return Infinity;
  }
}

/** Whether this voice demands the user do something before it will go away. */
export function requiresAction(voice: ToastVoice): boolean {
  return voice === "problem";
}
