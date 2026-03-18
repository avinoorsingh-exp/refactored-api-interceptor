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
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.dto\\.ts$',              // Exclude simple DTOs
    '\\.interface\\.ts$',         // Exclude interfaces
    '\\.types\\.ts$',             // Exclude type definitions
    '\\.constants\\.ts$',         // Exclude constants
    '/migrations/',              // Exclude DB migrations
    'main\\.ts$',                // Exclude bootstrap file
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary', 'cobertura'],
  coverageDirectory: '<rootDir>/coverage',
  moduleNameMapper: {
    '^\\.\\./countries/dto/country-lookup-item\\.dto\\.js$': '<rootDir>/src/modules/countries/dto/country-lookup-item.dto.ts',
    ...unitPreset.moduleNameMapper,
    '^@exprealty/shared-domain$': '<rootDir>/../../packages/shared-domain/src/index.ts',
    '^@exprealty/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@exprealty/logger$': '<rootDir>/../../packages/logger/src/index.ts',
    '^@exprealty/logger/metrics$': '<rootDir>/../../packages/logger/src/metrics.ts',
    '^@exprealty/logger/log-tier$': '<rootDir>/../../packages/logger/src/log-tier.ts',
    '^@exprealty/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@exprealty/cache$': '<rootDir>/../../packages/cache/src/index.ts',
    '^@exprealty/encryption$': '<rootDir>/../../packages/encryption/src/index.ts',
  },
};
