import { describe, expect, it } from 'vitest';
import { statusIndicator, type RealtimeStatus } from './status';

describe('realtime status indicator', () => {
  it('maps connected → lime/live, no banner', () => {
    const i = statusIndicator('connected');
    expect(i).toMatchObject({ tone: 'lime', live: true, showBanner: false });
  });

  it('maps reconnecting → amber + banner', () => {
    const i = statusIndicator('reconnecting');
    expect(i).toMatchObject({ tone: 'amber', live: false, showBanner: true });
  });

  it('maps disconnected → danger + banner', () => {
    const i = statusIndicator('disconnected');
    expect(i).toMatchObject({ tone: 'danger', live: false, showBanner: true });
  });

  it('maps connecting → amber, no banner', () => {
    expect(statusIndicator('connecting')).toMatchObject({ tone: 'amber', showBanner: false });
  });

  it('covers every status value', () => {
    const all: RealtimeStatus[] = ['disconnected', 'connecting', 'connected', 'reconnecting'];
    for (const s of all) expect(statusIndicator(s).label.length).toBeGreaterThan(0);
  });
});
