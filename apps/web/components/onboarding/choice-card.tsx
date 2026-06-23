'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChoiceCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: string;
  onClick: () => void;
}

/** A large tappable option card with leading icon, text, and a trailing chevron. */
export function ChoiceCard({ icon, title, subtitle, accent = 'bg-lime-soft', onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-4 rounded-lg border border-border bg-surface p-4 text-left shadow-soft transition-all',
        'hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-md text-ink', accent)}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
