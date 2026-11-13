export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.tsx?$': '<rootDir>/jest.esbuild.mjs',
  },
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
