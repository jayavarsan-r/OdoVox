'use client';

import { motion } from 'framer-motion';
import { mascotSizePx, type DecorativeObject, type MascotSize } from '@/lib/ds/mascot';
import { floatLoop } from '@/components/ds/motion';
import { cn } from '@/lib/utils';

/**
 * Decorative 3D dental objects (tooth, x-ray, mirror, pills, clipboard) used as
 * anchors on sparse screens. Renders via `background-image: var(--illu-object-*)`.
 * See design-system.md §8.
 */
export function DecorativeArt({
  object,
  size = 'md',
  float = true,
  className,
}: {
  object: DecorativeObject;
  size?: MascotSize;
  float?: boolean;
  className?: string;
}) {
  const px = mascotSizePx(size);
  return (
    <motion.div
      {...(float ? floatLoop : {})}
      aria-hidden
      style={{
        width: px,
        height: px,
        backgroundImage: `var(--illu-object-${object})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      className={cn('shrink-0', className)}
    />
  );
}
