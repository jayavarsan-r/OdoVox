/**
 * Floating action button / menu logic — drives <FAB> and <FabMenu>.
 * Open/close is a tiny reducer; item dispatch is a pure lookup-and-fire.
 * Unit-tested under node. See docs/design-system.md §6.
 */

export type FabTone = 'lime' | 'ink' | 'peach' | 'sky' | 'sage';

export interface FabItem {
  id: string;
  label: string;
  tone?: FabTone;
  onClick: () => void;
}

export interface FabState {
  open: boolean;
}

export type FabAction = { type: 'toggle' } | { type: 'open' } | { type: 'close' };

export const initialFabState: FabState = { open: false };

export function fabReducer(state: FabState, action: FabAction): FabState {
  switch (action.type) {
    case 'toggle':
      return { open: !state.open };
    case 'open':
      return { open: true };
    case 'close':
      return { open: false };
    default:
      return state;
  }
}

export function selectFabItem(items: readonly FabItem[], id: string): FabItem | undefined {
  return items.find((i) => i.id === id);
}

/**
 * Fire the matched item's action. Returns true when an item was found and run
 * (the menu always closes afterward), false when the id was unknown.
 */
export function dispatchFabItem(items: readonly FabItem[], id: string): boolean {
  const item = selectFabItem(items, id);
  if (!item) return false;
  item.onClick();
  return true;
}

/** Stagger delay (seconds) for the nth menu item's spring entrance. */
export function fabItemDelay(index: number, stagger = 0.04): number {
  return Math.max(0, index) * stagger;
}
