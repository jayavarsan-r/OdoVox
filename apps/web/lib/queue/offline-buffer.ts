/**
 * Small in-memory buffer for queue actions a user fired while offline. We DON'T fire them
 * speculatively (§5.1) — they're queued with a toast, then flushed through REST on reconnect. A
 * STALE_VERSION/INVALID_TRANSITION conflict means someone else already did it: drop it (no retry),
 * surface "already done". Genuine failures stay buffered for the next flush.
 */
export interface PendingAction {
  id: string;
  /** e.g. 'call-in', 'check-in' — used for the toast + dedupe. */
  kind: string;
  visitId: string;
  label: string;
}

export type FlushOutcome = 'ok' | 'conflict' | 'error';

export interface FlushResult {
  flushed: PendingAction[];
  conflicts: PendingAction[];
  failed: PendingAction[];
}

export class OfflineBuffer {
  private items: PendingAction[] = [];

  add(action: PendingAction): void {
    // Collapse duplicate intents (double-tap on the same visit+kind).
    if (this.items.some((a) => a.kind === action.kind && a.visitId === action.visitId)) return;
    this.items.push(action);
  }

  get pending(): readonly PendingAction[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  /**
   * Run each buffered action through `run`. Successful + conflicting actions are removed (conflicts
   * are terminal — someone else won); only genuine errors remain buffered for a later flush.
   */
  async flush(run: (action: PendingAction) => Promise<FlushOutcome>): Promise<FlushResult> {
    const flushed: PendingAction[] = [];
    const conflicts: PendingAction[] = [];
    const failed: PendingAction[] = [];
    const queued = [...this.items];
    for (const action of queued) {
      let outcome: FlushOutcome;
      try {
        outcome = await run(action);
      } catch {
        outcome = 'error';
      }
      if (outcome === 'ok') flushed.push(action);
      else if (outcome === 'conflict') conflicts.push(action);
      else failed.push(action);
    }
    this.items = failed; // keep only genuine failures for the next attempt
    return { flushed, conflicts, failed };
  }
}
