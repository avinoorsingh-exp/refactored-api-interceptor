const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'cache-unit',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/types.ts', // Type definitions only
  ],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
  },
};
