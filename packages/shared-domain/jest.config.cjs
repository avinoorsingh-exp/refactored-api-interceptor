const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'shared-domain-unit',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.unit.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts', // Exclude re-export files
  ],
  coverageThreshold: {
    global: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
};
