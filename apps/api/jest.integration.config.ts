export default {
  displayName: 'api-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['**/*.integration.spec.ts'],
  // Each suite starts its own Postgres container (see src/test-integration/integration-db.ts);
  // running them one at a time keeps local Docker load predictable and container logs readable on failure.
  maxWorkers: 1,
  testTimeout: 60000,
};
