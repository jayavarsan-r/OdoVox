import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Standard empty/placeholder block: illustration + title + body + optional CTA. */
export function EmptyState({
  illustration,
  title,
  body,
  cta,
  className,
}: {
  illustration?: ReactNode;
  title: string;
  body?: string;
  cta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-8 py-12 text-center', className)}>
      {illustration ? <div className="mb-5">{illustration}</div> : null}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {body ? <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p> : null}
      {cta ? <div className="mt-5">{cta}</div> : null}
    </div>
  );
}
