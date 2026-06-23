import { cn } from '@/lib/utils';

/** The Odovox tooth mark — a simple, friendly molar silhouette. */
export function ToothMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-6', className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3C8.7 3 7.5 4.4 5.7 4.4 4 4.4 3 5.9 3 8.2c0 2.1.7 3.6 1.3 5.6.4 1.4.5 2.9.8 4.6.2 1.3.5 2.6 1.4 2.6.8 0 1-.9 1.2-2.1.3-1.6.4-3.4 1.3-3.4h.4c.9 0 1 1.8 1.3 3.4.2 1.2.4 2.1 1.2 2.1.9 0 1.2-1.3 1.4-2.6.3-1.7.4-3.2.8-4.6.6-2 1.3-3.5 1.3-5.6 0-2.3-1-3.8-2.7-3.8-1.8 0-3 1.4-6.3 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Odovox wordmark with the lime accent. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-tight', className)}>
      Odo<span className="text-lime [text-shadow:0_1px_0_rgba(0,0,0,0.15)]">vox</span>
    </span>
  );
}

/** Tooth chip + wordmark lockup. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-9 items-center justify-center rounded-md bg-ink text-lime">
        <ToothMark className="size-5" />
      </span>
      <Wordmark className="text-2xl" />
    </div>
  );
}
