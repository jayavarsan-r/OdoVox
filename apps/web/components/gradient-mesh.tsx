import { cn } from '@/lib/utils';

type Variant = 'warm' | 'cool' | 'lime' | 'lab';

/** Three palette colors per variant: [top-right, bottom-left, mid-right]. */
const VARIANTS: Record<Variant, [string, string, string]> = {
  warm: ['var(--color-lime)', 'var(--color-peach)', 'var(--color-sky)'],
  cool: ['var(--color-sky)', 'var(--color-lavender)', 'var(--color-sage)'],
  lime: ['var(--color-lime)', 'var(--color-sage)', 'var(--color-lime-soft)'],
  lab: ['var(--color-lavender)', 'var(--color-sky)', 'var(--color-peach)'],
};

/** Soft, visible 3-blob pastel mesh behind app content. */
export function GradientMesh({
  variant = 'warm',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const [c1, c2, c3] = VARIANTS[variant];
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <div
        className="absolute -right-20 -top-20 h-[60vw] w-[60vw] rounded-full opacity-[0.18] blur-[120px]"
        style={{ backgroundColor: c1 }}
      />
      <div
        className="absolute -bottom-32 -left-24 h-[70vw] w-[70vw] rounded-full opacity-[0.14] blur-[120px]"
        style={{ backgroundColor: c2 }}
      />
      <div
        className="absolute -right-32 top-1/2 h-[40vw] w-[40vw] rounded-full opacity-[0.10] blur-[100px]"
        style={{ backgroundColor: c3 }}
      />
    </div>
  );
}
