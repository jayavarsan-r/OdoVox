import { describe, expect, it } from 'vitest';
import { buildPaymentLinkPayload } from '../src/lib/payments/razorpay-gateway.js';
import type { PaymentLinkInput } from '../src/lib/payments/gateway.js';

const base: PaymentLinkInput = {
  amountPaise: 350000,
  referenceId: 'PAY-SMABC123',
  description: 'Bill BL-SM1A2B - Smile Dental Care',
  customer: { name: 'Akhilesh', contact: '+919876543210', email: 'a@example.com' },
  notify: 'whatsapp',
  notes: { billId: 'bill_1', clinicId: 'clinic_1' },
};

describe('Razorpay payment-link payload', () => {
  it('sends amount in paise, INR, reference_id + notes echoed back, and disables Razorpay notify for WhatsApp', () => {
    const p = buildPaymentLinkPayload(base) as Record<string, unknown>;
    expect(p.amount).toBe(350000);
    expect(p.currency).toBe('INR');
    expect(p.accept_partial).toBe(false);
    expect(p.reference_id).toBe('PAY-SMABC123');
    expect(p.notes).toEqual({ billId: 'bill_1', clinicId: 'clinic_1' });
    expect(p.customer).toEqual({ name: 'Akhilesh', contact: '+919876543210', email: 'a@example.com' });
    // WhatsApp = we notify ourselves → Razorpay sms/email off
    expect(p.notify).toEqual({ sms: false, email: false });
  });

  it('enables Razorpay SMS when notify=sms/both and sets expire_by from expiresInHours', () => {
    const p = buildPaymentLinkPayload({ ...base, notify: 'sms', expiresInHours: 24 }) as Record<string, unknown>;
    expect(p.notify).toEqual({ sms: true, email: false });
    expect(p.reminder_enable).toBe(true);
    expect(typeof p.expire_by).toBe('number');
    expect(p.expire_by).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
