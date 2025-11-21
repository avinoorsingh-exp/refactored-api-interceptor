const unitPreset = require('../../jest.preset.unit.cjs');

module.exports = {
  ...unitPreset,
  displayName: 'orchestrator-unit',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
  ],
  // Use the same transform configuration as e2e tests for MSW support
  transform: {
    '^.+node_modules\\/(?:\\.pnpm\\/.*?\\/node_modules\\/)?until-async\\/.*\\.js$': 'babel-jest',
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          target: 'es2022',
        },
        module: {
          type: 'commonjs',
        },
      },
    ],
    '^.+\\.(mjs|cjs|js)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/.*?/node_modules/)?(msw|@mswjs|@bundled-es-modules|@open-draft|is-node-process|outvariant|strict-event-emitter|until-async|uuid)(/|$))',
  ],
  moduleNameMapper: {
    ...unitPreset.moduleNameMapper,
    '^@exprealty/shared-domain$': '<rootDir>/../../packages/shared-domain/src/index.ts',
    '^@exprealty/logger$': '<rootDir>/../../packages/logger/src/index.ts',
    '^@exprealty/logger/metrics$': '<rootDir>/../../packages/logger/src/metrics.ts',
    '^@exprealty/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@exprealty/cache$': '<rootDir>/../../packages/cache/src/index.ts',
  },
};