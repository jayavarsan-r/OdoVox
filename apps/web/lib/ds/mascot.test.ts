import { describe, expect, it } from 'vitest';
import {
  DECORATIVE_OBJECTS,
  MASCOT_POSES,
  decorativeAssetPath,
  decorativeAssetVar,
  mascotAssetPath,
  mascotAssetVar,
  mascotSizePx,
} from './mascot';

describe('mascot pose → asset mapping', () => {
  it('maps every pose to its CSS variable', () => {
    expect(mascotAssetVar('hero')).toBe('var(--illu-mascot-hero)');
    expect(mascotAssetVar('celebrate')).toBe('var(--illu-mascot-celebrate)');
    expect(mascotAssetVar('sleeping')).toBe('var(--illu-mascot-sleeping)');
  });

  it('has exactly the five approved poses', () => {
    expect([...MASCOT_POSES].sort()).toEqual(
      ['celebrate', 'hero', 'sleeping', 'smile', 'thinking'].sort(),
    );
  });

  it('maps each pose to a public PNG path', () => {
    for (const pose of MASCOT_POSES) {
      expect(mascotAssetPath(pose)).toBe(`/illu/mascot/odo-${pose}.png`);
    }
  });

  it('resolves size tokens to pixel diameters', () => {
    expect(mascotSizePx('sm')).toBe(80);
    expect(mascotSizePx('md')).toBe(140);
    expect(mascotSizePx('lg')).toBe(200);
    expect(mascotSizePx('xl')).toBe(280);
  });
});

describe('decorative object → asset mapping', () => {
  it('maps object keys to CSS variables', () => {
    expect(decorativeAssetVar('tooth')).toBe('var(--illu-object-tooth)');
    expect(decorativeAssetVar('xray')).toBe('var(--illu-object-xray)');
  });

  it('maps object keys to their (sometimes-renamed) file paths', () => {
    expect(decorativeAssetPath('tooth')).toBe('/illu/objects/tooth.png');
    expect(decorativeAssetPath('xray')).toBe('/illu/objects/xray-film.png');
    expect(decorativeAssetPath('mirror')).toBe('/illu/objects/dental-mirror.png');
    expect(decorativeAssetPath('pills')).toBe('/illu/objects/pill-bottle.png');
  });

  it('has exactly the five approved objects', () => {
    expect(DECORATIVE_OBJECTS).toHaveLength(5);
  });
});
