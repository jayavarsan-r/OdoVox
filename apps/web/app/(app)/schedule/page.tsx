import { PlaceholderPage } from '@/components/app-shell/placeholder-page';
import { IlluCalendarSoon } from '@/components/illustrations';

export default function SchedulePage() {
  return (
    <PlaceholderPage
      title="Schedule"
      illustration={<IlluCalendarSoon />}
      heading="Schedule lands in Phase 6"
      body="Calendar, slot availability, and reschedule. Phase 6 of 10."
    />
  );
}
