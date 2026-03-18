/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Split transforms: TS via ts-jest, JS via babel-jest
  
  transform: {
    // Make 100% sure we transpile ESM from this package:
    '^.+node_modules\\/(?:\\.pnpm\\/.*?\\/node_modules\\/)?until-async\\/.*\\.js$': 'babel-jest',

    // Then your normal split:
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/test/tsconfig.base.json' }
    ],
    '^.+\\.(mjs|cjs|js)$': 'babel-jest',
  },

  // pnpm-aware allowlist for ESM deps (includes `until-async`)
  transformIgnorePatterns: [],

  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 10000,
  verbose: true,

  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '\\.spec\\.ts$',
    '\\.e2e-spec\\.ts$',
  ],
  coverageThreshold: {
    global: { lines: 85, statements: 85, functions: 80, branches: 75 },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
