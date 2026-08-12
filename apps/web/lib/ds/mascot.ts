/**
 * Odovox mascot (Odo) + decorative 3D-object asset mapping.
 * Framework-free so it is unit-tested under the node vitest env, and shared by
 * <MascotMoment> / <DecorativeArt>. See docs/design-system.md §7–8.
 */

export type MascotPose =
  | "hero"
  | "smile"
  | "celebrate"
  | "thinking"
  | "concerned"
  | "sleeping";
export type MascotSize = "sm" | "md" | "lg" | "xl";
export type MascotAnimation = "none" | "float" | "bounce-in" | "gentle-pulse";
export type MascotBackground = "none" | "cream" | "glass";
export type DecorativeObject =
  | "tooth"
  | "xray"
  | "mirror"
  | "pills"
  | "clipboard";

export const MASCOT_POSES: readonly MascotPose[] = [
  "hero",
  "smile",
  "celebrate",
  "thinking",
  "concerned",
  "sleeping",
];

export const DECORATIVE_OBJECTS: readonly DecorativeObject[] = [
  "tooth",
  "xray",
  "mirror",
  "pills",
  "clipboard",
];

/** CSS custom property holding the `url()` for a mascot pose (consumed via background-image). */
export function mascotAssetVar(pose: MascotPose): string {
  return `var(--illu-mascot-${pose})`;
}

/** CSS custom property holding the `url()` for a decorative object. */
export function decorativeAssetVar(object: DecorativeObject): string {
  return `var(--illu-object-${object})`;
}

/** Public path to a mascot PNG (placeholder today, AI-generated later) — used for preloading. */
export function mascotAssetPath(pose: MascotPose): string {
  return `/illu/mascot/odo-${pose}.png`;
}

/** File stems differ from the semantic key for some objects. */
const OBJECT_FILE: Record<DecorativeObject, string> = {
  tooth: "tooth",
  xray: "xray-film",
  mirror: "dental-mirror",
  pills: "pill-bottle",
  clipboard: "clipboard",
};

export function decorativeAssetPath(object: DecorativeObject): string {
  return `/illu/objects/${OBJECT_FILE[object]}.png`;
}

/**
 * The ladder is the spec's own Odo sizes, not an invented scale.
 *
 * Every `<svg viewBox="0 0 64 64">` in odovox-v9-master.html was measured: the spec
 * draws Odo at 21, 30, 34, 36, 50, 52, 64, 96, 104, 110, 116, 120, 128, 132 and 140 —
 * and **never larger than 140**. The previous ladder ran to 280, so `lg` and `xl` both
 * drew a mascot bigger than anything the design contains; frame 01 wants 120 and was
 * getting 200. Four rungs, one per cluster.
 */
export const MASCOT_SIZE_PX: Record<MascotSize, number> = {
  sm: 34,
  md: 64,
  lg: 120,
  xl: 140,
};

export function mascotSizePx(size: MascotSize): number {
  return MASCOT_SIZE_PX[size];
}
