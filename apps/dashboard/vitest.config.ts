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
        statements: 65,
        branches: 68,
        functions: 60,
        lines: 70,
      },
    },
  },
});
