// CommonJS preset so Jest can require() it in any package
/** @type {import('jest').Config} */
module.exports = {
  displayName: 'unit',
  testEnvironment: 'node',
  // Treat TS as ESM when your source uses NodeNext/ESNext imports
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.(t|j)sx?$': ['@swc/jest'] },
  moduleNameMapper: {
    // Fixes TS ESM paths that end with .js in source
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '<rootDir>/**/?(*.)+(spec|test).ts',
    '!**/*.e2e.(spec|test).ts',
  ],
  setupFilesAfterEnv: [],
  coverageDirectory: '<rootDir>/coverage-unit',
  collectCoverageFrom: [
    '**/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 75, branches: 70 },
  },
};
