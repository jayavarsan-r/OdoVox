import { describe, expect, it, vi } from 'vitest';
import {
  dispatchFabItem,
  fabItemDelay,
  fabReducer,
  initialFabState,
  selectFabItem,
} from './fab';

describe('fabReducer', () => {
  it('toggles open/closed', () => {
    const opened = fabReducer(initialFabState, { type: 'toggle' });
    expect(opened.open).toBe(true);
    expect(fabReducer(opened, { type: 'toggle' }).open).toBe(false);
  });

  it('honours explicit open/close', () => {
    expect(fabReducer(initialFabState, { type: 'open' }).open).toBe(true);
    expect(fabReducer({ open: true }, { type: 'close' }).open).toBe(false);
  });
});

describe('fab item dispatch', () => {
  const items = [
    { id: 'new-patient', label: 'New patient', onClick: vi.fn() },
    { id: 'new-appointment', label: 'New appointment', onClick: vi.fn() },
  ];

  it('selects an item by id', () => {
    expect(selectFabItem(items, 'new-patient')?.label).toBe('New patient');
    expect(selectFabItem(items, 'ghost')).toBeUndefined();
  });

  it('fires the matched item action and reports success', () => {
    const onClick = vi.fn();
    const ok = dispatchFabItem([{ id: 'quick-rx', label: 'Rx', onClick }], 'quick-rx');
    expect(ok).toBe(true);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('returns false and fires nothing for an unknown id', () => {
    const onClick = vi.fn();
    expect(dispatchFabItem([{ id: 'a', label: 'A', onClick }], 'z')).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('fabItemDelay', () => {
  it('staggers entrance by index', () => {
    expect(fabItemDelay(0)).toBe(0);
    expect(fabItemDelay(2)).toBeCloseTo(0.08);
    expect(fabItemDelay(-1)).toBe(0);
  });
});
