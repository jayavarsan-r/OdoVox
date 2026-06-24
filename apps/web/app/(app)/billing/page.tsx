import { PlaceholderPage } from '@/components/app-shell/placeholder-page';
import { IlluPaymentSoon } from '@/components/illustrations';

export default function BillingPage() {
  return (
    <PlaceholderPage
      title="Billing"
      illustration={<IlluPaymentSoon />}
      heading="Billing lands in Phase 8"
      body="Collect payments, send statements, and track dues. Phase 8 of 10."
    />
  );
}
