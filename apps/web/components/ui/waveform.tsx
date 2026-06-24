import { cn } from '@/lib/utils';

/**
 * Decorative static sound-wave — the same bar motif as the VoiceButton, stretched and faint.
 * Quietly signals "voice" without competing for attention. Purely ornamental (aria-hidden).
 */
export function DecorativeWaveform({ className }: { className?: string }) {
  // A symmetric-ish set of bar heights across the width.
  const heights = [6, 12, 20, 10, 28, 16, 34, 22, 40, 22, 34, 16, 28, 10, 20, 12, 6];
  return (
    <div
      aria-hidden
      className={cn('flex h-10 w-full items-center justify-center gap-1 opacity-20', className)}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-pill bg-lime"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
