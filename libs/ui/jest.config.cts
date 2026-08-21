module.exports = {
  displayName: 'ui',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/libs/ui',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // culori, apca-w3, and apca-w3's own dependency colorparsley all ship ESM-only ("type":
  // "module", no CJS build reachable via their "exports" map for a plain `import` specifier) —
  // same class of problem as pinyes-render's Konva exception.
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|.*culori.*|.*apca-w3.*|.*colorparsley.*))'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
