'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

/** A back chevron + optional title row for onboarding sub-screens. */
export function BackHeader({ title }: { title?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1 px-5 pt-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Go back"
        className="-ml-2 flex size-10 items-center justify-center rounded-pill text-foreground transition-colors hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </button>
      {title ? <span className="text-sm font-medium text-muted-foreground">{title}</span> : null}
    </div>
  );
}
