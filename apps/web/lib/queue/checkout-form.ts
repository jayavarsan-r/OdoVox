import { CheckoutFormInput, type CompleteVisitInput, type PaymentMethod } from '@odovox/types';

/**
 * Receptionist checkout form. Phase 4 keeps billing minimal (amount + method); Phase 8 reworks this
 * with Razorpay. `buildCompleteBody` only attaches a payment when one is actually being taken. The
 * zod schema lives in @odovox/types (the web app has no direct zod dependency).
 */
export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'UPI', 'CARD', 'OTHER'];

export const CheckoutFormSchema = CheckoutFormInput;
export type CheckoutForm = CheckoutFormInput;

export function defaultCheckoutForm(duePaise: number | null): CheckoutForm {
  return {
    takePayment: (duePaise ?? 0) > 0,
    method: 'CASH',
    amountPaise: duePaise ?? 0,
    reference: undefined,
    notes: undefined,
    prescriptionHanded: false,
    nextVisitConfirmed: false,
  };
}

export function buildCompleteBody(form: CheckoutForm): CompleteVisitInput {
  const body: CompleteVisitInput = {
    prescriptionHanded: form.prescriptionHanded,
    nextVisitConfirmed: form.nextVisitConfirmed,
  };
  if (form.takePayment && form.amountPaise > 0) {
    body.payment = {
      method: form.method,
      amountPaise: form.amountPaise,
      ...(form.reference ? { reference: form.reference } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    };
  }
  return body;
}

export function rupees(paise: number | null): string {
  if (paise == null) return '—';
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
