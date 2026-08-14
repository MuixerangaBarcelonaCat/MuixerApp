const { createCjsPreset } = require('jest-preset-angular/presets');

module.exports = {
  displayName: 'pinyes-render',
  ...createCjsPreset(),
  // konva ships ESM-only ("type": "module", no CJS build) — specs never exercise
  // FigureCanvasComponent's real Konva wiring (it's always swapped for a stub, see
  // the named exception in the plan), but importing its *type* to pass to
  // TestBed.overrideComponent still requires Jest to be able to parse the module.
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|.*konva.*))'],
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
      statements: 92,
      branches: 78,
      functions: 93,
      lines: 94,
    },
  },
};
