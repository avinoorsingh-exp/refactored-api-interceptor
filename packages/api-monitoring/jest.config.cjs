const unitPreset = require('../../jest.preset.unit.cjs');
const path = require('path');

module.exports = {
  ...unitPreset,
  displayName: 'api-monitoring-unit',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
  ],
  moduleNameMapper: {
    ...unitPreset.moduleNameMapper,
    '^@exprealty/database$': path.resolve(__dirname, '../database/src/index.ts'),
    '^@exprealty/shared-domain$': path.resolve(__dirname, '../shared-domain/src/index.ts'),
    '^@exprealty/logger$': path.resolve(__dirname, '../logger/src/index.ts'),
    '^@exprealty/cache$': path.resolve(__dirname, '../cache/src/index.ts'),
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/utils/pagination.util.ts',
    'src/services/api-metrics.service.ts',
    'src/api-monitoring.controller.ts',
    'src/dto/pagination-query.dto.ts',
    'src/dto/error-sample-query.dto.ts',
    'src/dto/actor-activity-query.dto.ts',
    'src/dto/page-info.dto.ts',
    'src/dto/paginated-*.dto.ts',
    'src/dto/summary-response.dto.ts',
    'src/dto/top-caller-response.dto.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 60, // DTOs are data classes, lower function coverage is acceptable
      branches: 65,
      statements: 70,
    },
  },
};

