'use client';

import { motion } from 'framer-motion';
import { Children } from 'react';
import type { ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Soft fade-up entrance for a whole route. Wrap every page's content. */
export function AnimatedPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Stagger each direct child in by 40ms — used to bring form fields in one by one. */
export function StaggeredFields({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
