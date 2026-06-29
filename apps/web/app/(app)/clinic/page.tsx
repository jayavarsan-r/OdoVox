'use client';

import { useRouter } from 'next/navigation';
import { FileText, ChevronRight } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, HeroCard } from '@/components/ds';
import { IlluBuildingSoon } from '@/components/illustrations';

export default function ClinicPage() {
  const router = useRouter();
  return (
    <AnimatedPage>
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        <EditorialHeading title="Clinic" />

        <HeroCard
          variant="light"
          size="compact"
          title="Prescription templates"
          subtitle="Reusable medicine bundles for common cases"
          icon={<FileText />}
          trailing={<ChevronRight />}
          onClick={() => router.push('/clinic/templates')}
        />

        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <div className="mx-auto mb-3 w-24">
            <IlluBuildingSoon />
          </div>
          <p className="font-medium text-ink">Team, rooms, hours &amp; join code</p>
          <p className="mt-1 text-sm text-text-muted">Clinic settings expand in Phase 6 of 10.</p>
        </div>
      </div>
    </AnimatedPage>
  );
}
