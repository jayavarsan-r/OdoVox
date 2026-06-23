import { cn } from '@/lib/utils';

/**
 * Mobile-first shell: a 430px-max column centred on larger viewports, full dynamic-viewport
 * height, with safe-area insets respected top and bottom.
 */
export function MobileShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-mobile flex-col">
      <div
        className={cn('relative z-10 flex flex-1 flex-col', className)}
        style={{
          paddingTop: 'var(--safe-top)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
