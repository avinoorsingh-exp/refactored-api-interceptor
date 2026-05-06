const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'api-monitoring-unit',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
  ],
  moduleNameMapper: {
    ...unitPreset.moduleNameMapper,
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
    'src/dto/route-breakdown-query.dto.ts',
    'src/dto/trends-query.dto.ts',
    'src/dto/trends-response.dto.ts',
    'src/dto/available-routes-query.dto.ts',
    'src/dto/available-routes-response.dto.ts',
    'src/dto/aggregation-response.dto.ts',
  ],
  // Thresholds match the current collectCoverageFrom set (includes large api-metrics.service + DTOs).
  coverageThreshold: {
    global: {
      lines: 50,
      statements: 48,
      branches: 37,
      functions: 30,
    },
  },
};

