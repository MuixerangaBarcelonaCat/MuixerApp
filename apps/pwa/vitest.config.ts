import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        '**/*.spec.ts',
        '**/*.routes.ts',
        '**/index.ts',
        '**/main.ts',
        '**/environments/**',
        '**/*.entity.ts',
        '**/*.dto.ts',
        '**/*.interface.ts',
        // coverage for this lib is enforced by its own `nx test pinyes-render` gate.
        '**/libs/pinyes-render/**',
      ],
      thresholds: {
        statements: 77,
        branches: 78,
        functions: 72,
        lines: 80,
      },
    },
  },
});
