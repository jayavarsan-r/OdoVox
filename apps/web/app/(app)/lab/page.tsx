import { PlaceholderPage } from '@/components/app-shell/placeholder-page';
import { IlluFlaskSoon } from '@/components/illustrations';

export default function LabPage() {
  return (
    <PlaceholderPage
      title="Lab"
      illustration={<IlluFlaskSoon />}
      heading="Lab tracking lands in Phase 7"
      body="Track crowns, dentures, and aligners from impression to fitting. Phase 7 of 10."
    />
  );
}
