/**
 * Odovox mascot (Odo) + decorative 3D-object asset mapping.
 * Framework-free so it is unit-tested under the node vitest env, and shared by
 * <MascotMoment> / <DecorativeArt>. See docs/design-system.md §7–8.
 */

export type MascotPose = 'hero' | 'smile' | 'celebrate' | 'thinking' | 'sleeping';
export type MascotSize = 'sm' | 'md' | 'lg' | 'xl';
export type MascotAnimation = 'none' | 'float' | 'bounce-in' | 'gentle-pulse';
export type MascotBackground = 'none' | 'cream' | 'glass';
export type DecorativeObject = 'tooth' | 'xray' | 'mirror' | 'pills' | 'clipboard';

export const MASCOT_POSES: readonly MascotPose[] = [
  'hero',
  'smile',
  'celebrate',
  'thinking',
  'sleeping',
];

export const DECORATIVE_OBJECTS: readonly DecorativeObject[] = [
  'tooth',
  'xray',
  'mirror',
  'pills',
  'clipboard',
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
  tooth: 'tooth',
  xray: 'xray-film',
  mirror: 'dental-mirror',
  pills: 'pill-bottle',
  clipboard: 'clipboard',
};

export function decorativeAssetPath(object: DecorativeObject): string {
  return `/illu/objects/${OBJECT_FILE[object]}.png`;
}

export const MASCOT_SIZE_PX: Record<MascotSize, number> = {
  sm: 80,
  md: 140,
  lg: 200,
  xl: 280,
};

export function mascotSizePx(size: MascotSize): number {
  return MASCOT_SIZE_PX[size];
}
