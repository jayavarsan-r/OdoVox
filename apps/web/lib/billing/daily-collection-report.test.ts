import { describe, expect, it } from 'vitest';
import { collectionCsv } from './format';

describe('daily collection report', () => {
  it('builds a CSV with a header and escaped fields', () => {
    const csv = collectionCsv([
      { time: '14:32', patient: 'Akhilesh G', amountPaise: 350000, method: 'CASH', doctor: 'Asha' },
      { time: '14:05', patient: 'Priya, R', amountPaise: 240000, method: 'UPI_MANUAL', doctor: 'Asha' },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]!).toBe('Time,Patient,Amount,Method,Doctor');
    expect(lines[1]!).toBe('14:32,Akhilesh G,3500.00,Cash,Asha');
    expect(lines[2]!).toBe('14:05,"Priya, R",2400.00,UPI,Asha'); // comma-escaped
  });
});
