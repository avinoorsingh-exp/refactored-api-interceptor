const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'logger-unit',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/index.ts',
    'src/nest-logger.ts',
    '!src/**/*.js', // Exclude pre-built JS files
    '!src/**/*.d.ts',
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
