import { describe, expect, it } from 'vitest';
import { collectionStatTiles, rupeesCompact } from './format';
import type { DailyCollectionResponse } from '@odovox/types';

const collection: DailyCollectionResponse = {
  date: '2026-06-23', totalCollectedPaise: 1450000,
  byMethod: { CASH: 520000, UPI_MANUAL: 600000, RAZORPAY: 330000 } as DailyCollectionResponse['byMethod'],
  byDoctor: [], transactionCount: 6, refundsCount: 0, totalRefundedPaise: 0,
};

describe('today stat tiles', () => {
  it('derives Collected / Cash / Online / Pending from the daily collection + queue', () => {
    const tiles = collectionStatTiles(collection, 3);
    expect(tiles.map((t) => t.label)).toEqual(['Collected', 'Cash', 'Online', 'Pending']);
    expect(tiles[0]!.value).toBe('₹14.5k');
    expect(tiles[1]!.value).toBe('₹5.2k'); // cash
    expect(tiles[2]!.value).toBe('₹9.3k'); // online = UPI + Razorpay
    expect(tiles[3]!.value).toBe('3');
    expect(tiles[3]!.variant).toBe('warning');
  });

  it('formats compact rupees across magnitudes', () => {
    expect(rupeesCompact(98000)).toBe('₹980');
    expect(rupeesCompact(1450000)).toBe('₹14.5k');
    expect(rupeesCompact(25000000)).toBe('₹2.5L');
  });
});
