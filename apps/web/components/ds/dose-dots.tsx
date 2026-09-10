import { cn } from "@/lib/utils";
import { doseDotsFromFrequency } from "@/lib/ds/dose";

/**
 * `.dd` — morning · afternoon · night dose dots. ●○● reads across the room, which is
 * the point: v9-44 puts these on every medicine card and prints the legend once,
 * above the CTA, rather than repeating "1-0-1" on each row.
 *
 * Spec: 10×10 dots, gap 6; filled = lime with a 2.5px lime-soft halo,
 * empty = `rgba(31,42,35,.12)` with no halo.
 */
export interface DoseDotsProps {
  /** Explicit pattern, e.g. [true, false, true]. Takes precedence over `frequency`. */
  pattern?: boolean[];
  /** OD / BD / TID / QID / SOS — mapped by `doseDotsFromFrequency`. */
  frequency?: string | null;
  /** Trailing caption, e.g. "AFTER FOOD" or "3 days · if pain". */
  caption?: string;
  className?: string;
}

export function DoseDots({
  pattern,
  frequency,
  caption,
  className,
}: DoseDotsProps) {
  const dots = pattern ?? doseDotsFromFrequency(frequency);
  const spoken = dots
    .map((d, i) => (d ? ["morning", "afternoon", "night"][i] : null))
    .filter(Boolean);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="sr-only">
        {spoken.length ? `Dose: ${spoken.join(", ")}` : "Dose: as needed"}
      </span>
      {dots.map((filled, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "size-2.5 rounded-pill",
            filled
              ? "bg-lime shadow-[0_0_0_2.5px_var(--lime-soft)]"
              : "bg-[rgba(31,42,35,0.12)]",
          )}
        />
      ))}
      {caption ? (
        <span className="ml-1 text-eyebrow font-heavy tracking-label text-pine-3">
          {caption}
        </span>
      ) : null}
    </span>
  );
}
