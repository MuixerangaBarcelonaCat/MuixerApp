import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  {
    // Audit/diagnostic scripts (not the product test suite): they intentionally
    // walk routes, wait for the page to settle (networkidle / timeouts), branch
    // on device/data state, and record metrics instead of asserting. The
    // Playwright best-practice rules aimed at flaky product tests don't apply.
    files: ['src/audit*/**/*.ts'],
    rules: {
      'playwright/no-networkidle': 'off',
      'playwright/no-wait-for-timeout': 'off',
      'playwright/no-conditional-in-test': 'off',
      'playwright/expect-expect': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
];
