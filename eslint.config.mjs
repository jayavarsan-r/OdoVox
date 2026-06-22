import base from '@odovox/config/eslint-base.cjs';

/**
 * Root flat ESLint config. Applies to all packages that don't define their own
 * nearer config (apps/web supplies its own for the Next.js/React rules).
 */
export default [...base];
