import { describe, expect, it } from 'vitest';
import { OfflineBuffer, type PendingAction } from './offline-buffer';

const action = (over: Partial<PendingAction> = {}): PendingAction => ({
  id: 'a1',
  kind: 'call-in',
  visitId: 'v1',
  label: 'Call in Akhilesh',
  ...over,
});

describe('offline action buffer', () => {
  it('buffers actions and dedupes the same visit+kind', () => {
    const buf = new OfflineBuffer();
    buf.add(action({ id: 'a1' }));
    buf.add(action({ id: 'a2' })); // same kind+visit → collapsed
    expect(buf.size).toBe(1);
  });

  it('flushes all buffered actions on reconnect, clearing successes', async () => {
    const buf = new OfflineBuffer();
    buf.add(action({ id: 'a1', visitId: 'v1' }));
    buf.add(action({ id: 'a2', visitId: 'v2' }));
    const res = await buf.flush(async () => 'ok');
    expect(res.flushed).toHaveLength(2);
    expect(buf.size).toBe(0);
  });

  it('drops conflicts (someone else already did it) without retrying', async () => {
    const buf = new OfflineBuffer();
    buf.add(action({ id: 'a1', visitId: 'v1' }));
    const res = await buf.flush(async () => 'conflict');
    expect(res.conflicts).toHaveLength(1);
    expect(buf.size).toBe(0); // not retried
  });

  it('keeps genuine failures buffered for the next flush', async () => {
    const buf = new OfflineBuffer();
    buf.add(action({ id: 'a1', visitId: 'v1' }));
    buf.add(action({ id: 'a2', visitId: 'v2' }));
    const res = await buf.flush(async (a) => (a.visitId === 'v1' ? 'ok' : 'error'));
    expect(res.flushed.map((a) => a.visitId)).toEqual(['v1']);
    expect(res.failed.map((a) => a.visitId)).toEqual(['v2']);
    expect(buf.size).toBe(1); // v2 stays
  });
});
