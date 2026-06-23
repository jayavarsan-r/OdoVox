import { cn } from '@/lib/utils';

const PRESETS = {
  one: [
    'left-[-20%] top-[-10%] bg-lime',
    'right-[-25%] top-[20%] bg-peach',
    'bottom-[-15%] left-[10%] bg-sky',
  ],
  two: [
    'right-[-20%] top-[-15%] bg-sky',
    'left-[-25%] top-[30%] bg-lavender',
    'bottom-[-10%] right-[5%] bg-lime',
  ],
  three: [
    'left-[-15%] top-[5%] bg-peach',
    'right-[-20%] top-[-10%] bg-sage',
    'bottom-[-20%] left-[20%] bg-lavender',
  ],
  four: [
    'right-[-15%] bottom-[-10%] bg-lime',
    'left-[-20%] top-[-5%] bg-sky',
    'right-[10%] top-[25%] bg-peach',
  ],
} as const;

/** Soft, blurred 3-blob pastel mesh behind onboarding content. */
export function GradientMesh({
  preset = 'one',
  className,
}: {
  preset?: keyof typeof PRESETS;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {PRESETS[preset].map((pos, i) => (
        <div
          key={i}
          className={cn(
            'absolute size-72 rounded-pill opacity-40 blur-[80px]',
            pos,
          )}
        />
      ))}
    </div>
  );
}
