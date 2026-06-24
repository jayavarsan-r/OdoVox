import type { ReactNode } from 'react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, EmptyState } from '@/components/ds';
import { ProfileButton } from '@/components/app-shell/profile-button';

/** A polished "coming in Phase X" page for tabs not yet built. */
export function PlaceholderPage({
  title,
  illustration,
  heading,
  body,
}: {
  title: string;
  illustration: ReactNode;
  heading: string;
  body: string;
}) {
  return (
    <AnimatedPage className="flex flex-1 flex-col px-5 pt-8">
      <EditorialHeading title={title} trailing={<ProfileButton />} />
      <EmptyState variant="page" illustration={illustration} title={heading} body={body} />
    </AnimatedPage>
  );
}
