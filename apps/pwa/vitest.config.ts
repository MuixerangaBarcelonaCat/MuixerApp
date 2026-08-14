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
      ],
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 74,
        lines: 83,
      },
    },
  },
});
