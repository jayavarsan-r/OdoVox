import globals from 'globals';
import base from '@odovox/config/eslint-base.cjs';

/** Web flat ESLint config — shared base plus browser globals for React/Next code. */
export default [
  ...base,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
