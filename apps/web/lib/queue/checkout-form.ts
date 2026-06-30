import { CheckoutFormInput, type CompleteVisitInput, type PaymentMethod } from '@odovox/types';

/**
 * Receptionist checkout form. Phase 4 keeps billing minimal (amount + method); Phase 8 reworks this
 * with Razorpay. `buildCompleteBody` only attaches a payment when one is actually being taken. The
 * zod schema lives in @odovox/types (the web app has no direct zod dependency).
 */
// Inline quick-checkout methods. The full itemized checkout sheet (Phase 8 Stage 7) adds Razorpay
// links and method-specific fields; this one-tap path covers Cash / UPI / Card / Bank.
export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'UPI_MANUAL', 'CARD_MANUAL', 'BANK_TRANSFER'];

/** Short human label for a payment method (used by the checkout method picker). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI_MANUAL: 'UPI',
  CARD_MANUAL: 'Card',
  BANK_TRANSFER: 'Bank',
  RAZORPAY: 'Razorpay link',
  ADJUSTMENT: 'Adjustment',
};

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
    acceptBalance: false,
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
