const { createCjsPreset } = require('jest-preset-angular/presets');

module.exports = {
  displayName: 'pinyes-render',
  ...createCjsPreset(),
  resolver: '@nx/jest/plugins/resolver',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/libs/pinyes-render',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/test-setup.ts',
    '!src/testing/**',
    // Konva wiring with no meaningful jsdom signal — characterized by the Playwright
    // gesture-audit golden baseline instead (docs/AUDIT_SUITE.md), not a unit spec.
    '!src/lib/components/figure-canvas/figure-canvas.component.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 69,
      functions: 83,
      lines: 82,
    },
  },
};
