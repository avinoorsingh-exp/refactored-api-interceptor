const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'agent-service-unit',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
  ],
  moduleNameMapper: {
    ...unitPreset.moduleNameMapper,
    '^@exprealty/shared-domain$': '<rootDir>/../../packages/shared-domain/src/index.ts',
    '^@exprealty/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@exprealty/logger$': '<rootDir>/../../packages/logger/src/index.ts',
    '^@exprealty/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@exprealty/cache$': '<rootDir>/../../packages/cache/src/index.ts',
  },
};
