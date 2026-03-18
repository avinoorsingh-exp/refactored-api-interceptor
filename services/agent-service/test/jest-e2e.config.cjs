// services/agent-service/test/jest-e2e.config.cjs
const path = require('path')

/** @type {import('jest').Config} */
module.exports = {
  displayName: 'agent-service-e2e',
  rootDir: path.resolve(__dirname, '../../..'),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/services/agent-service/test/**/*.e2e-spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // map workspace package aliases to source
    '^@exprealty/(.*)$': '<rootDir>/packages/$1/src',
  },
  // ⬇️ Put this *first* so it wins before the generic rules
  transform: {
    '^.+node_modules\\/(?:\\.pnpm\\/.*?\\/node_modules\\/)?until-async\\/.*\\.js$': 'babel-jest',
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/test/tsconfig.base.json' }
    ],
    '^.+\\.(mjs|cjs|js)$': 'babel-jest',
  },

  // pnpm-aware allowlist (keep exactly this)
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/.*?/node_modules/)?(msw|@mswjs|@bundled-es-modules|@open-draft|is-node-process|outvariant|strict-event-emitter|until-async|uuid)(/|$))',
  ],

  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 10000,
  verbose: true,
}
