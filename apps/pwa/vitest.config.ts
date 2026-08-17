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
        // Each lib enforces its own coverage in its own `nx test <lib>` gate.
        '**/libs/pinyes-render/**',
        '**/libs/shared/**',
      ],
      thresholds: {
        statements: 77,
        branches: 80,
        functions: 71,
        lines: 80,
      },
    },
  },
});
