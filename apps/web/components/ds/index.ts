/**
 * Odovox design-system primitives. Every screen composes from here — never
 * hand-roll an established pattern. Source of truth: docs/design-system.md.
 */
export { HeroCard, type HeroCardProps } from "./hero-card";
export { GlassCard, type GlassCardProps } from "./glass-card";
export { EmptyState } from "./empty-state";
export { StepperHeader } from "./stepper-header";
export { FAB, FabMenu, type FabMenuItem } from "./fab";
export { EditorialHeading } from "./editorial-heading";
export { StatTile, StatPill, type StatTileProps } from "./stat-tile";
export {
  BentoTile,
  type BentoTileProps,
  type BentoTileTone,
} from "./bento-tile";
export {
  DecorativeFooter,
  type DecorativeFooterVariant,
} from "./decorative-footer";
export { AnnotationCallout } from "./annotation-callout";

/* --- Wave 1 · v9 atoms ------------------------------------------------------ */
export { IconCircle, type IconCircleProps } from "./icon-circle";
export { Toggle, type ToggleProps } from "./toggle";
export { StatusDot, type StatusDotProps } from "./status-dot";
export { DoseDots, type DoseDotsProps } from "./dose-dots";
export { ProgressRing, type ProgressRingProps } from "./progress-ring";
export {
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
} from "./segmented";

export * from "./motion";
