import { describe, expect, it } from 'vitest';
import { waMeLink } from './format';

describe('razorpay link sheet', () => {
  it('builds a wa.me deep link with digits-only phone and an encoded message', () => {
    const link = waMeLink('+91 98765 43210', 'Pay here: https://rzp.io/i/abc');
    expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(link).toContain(encodeURIComponent('Pay here: https://rzp.io/i/abc'));
  });
});
