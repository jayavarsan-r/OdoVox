import { PlaceholderPage } from '@/components/app-shell/placeholder-page';
import { IlluBuildingSoon } from '@/components/illustrations';

export default function ClinicPage() {
  return (
    <PlaceholderPage
      title="Clinic"
      illustration={<IlluBuildingSoon />}
      heading="Clinic settings expand in Phase 6"
      body="Team, rooms, hours, and the join code live here. Phase 6 of 10."
    />
  );
}
