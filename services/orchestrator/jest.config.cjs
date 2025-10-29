const baseConfig = require('../../jest.config.base.cjs');

module.exports = {
  ...baseConfig,
  displayName: 'orchestrator-unit',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
  ],
};