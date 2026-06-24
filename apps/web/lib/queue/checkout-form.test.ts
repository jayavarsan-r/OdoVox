import { describe, expect, it } from 'vitest';
import {
  buildCompleteBody,
  CheckoutFormSchema,
  defaultCheckoutForm,
  rupees,
  type CheckoutForm,
} from './checkout-form';

const base: CheckoutForm = {
  takePayment: true,
  method: 'CASH',
  amountPaise: 350000,
  prescriptionHanded: true,
  nextVisitConfirmed: false,
};

describe('checkout form', () => {
  it('defaults the amount to the amount due', () => {
    expect(defaultCheckoutForm(350000)).toMatchObject({ takePayment: true, amountPaise: 350000 });
    expect(defaultCheckoutForm(null)).toMatchObject({ takePayment: false, amountPaise: 0 });
  });

  it('builds a complete body with a payment', () => {
    const body = buildCompleteBody(base);
    expect(body.payment).toEqual({ method: 'CASH', amountPaise: 350000 });
    expect(body.prescriptionHanded).toBe(true);
  });

  it('omits the payment when not taking one', () => {
    const body = buildCompleteBody({ ...base, takePayment: false });
    expect(body.payment).toBeUndefined();
  });

  it('omits the payment when amount is zero even if takePayment is true', () => {
    const body = buildCompleteBody({ ...base, amountPaise: 0 });
    expect(body.payment).toBeUndefined();
  });

  it('rejects taking a payment with a zero amount', () => {
    const res = CheckoutFormSchema.safeParse({ ...base, amountPaise: 0 });
    expect(res.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(CheckoutFormSchema.safeParse({ ...base, amountPaise: -1 }).success).toBe(false);
  });

  it('formats rupees from paise', () => {
    expect(rupees(350000)).toBe('₹3,500');
    expect(rupees(null)).toBe('—');
  });
});
