// jest.config.ts (root)
import { pathsToModuleNameMapper } from 'ts-jest'
import { compilerOptions } from './tsconfig.json'

const base: import('jest').Config = {
	testEnvironment: 'node',
	// Let each package/service define its own displayName/roots via local config.
	projects: [
		'<rootDir>/packages/*/jest.config.ts',
		'<rootDir>/services/*/jest.config.ts',
	],
	// If you ever run tests at root (rare), these apply:
	collectCoverage: true,
	collectCoverageFrom: [
		// sensible defaults; packages/services override as needed
		'**/src/**/*.{ts,tsx,js,jsx}',
		'!**/*.d.ts',
		'!**/node_modules/**',
		'!**/dist/**',
	],
	coverageReporters: ['text', 'lcov', 'cobertura', 'json-summary'],
	coverageDirectory: '<rootDir>/coverage',
	coverageThreshold: {
		global: {
			lines: 85,
			statements: 85,
			functions: 80,
			branches: 75,
		},
	},
	// Path aliases from tsconfig -> Jest
	moduleNameMapper: pathsToModuleNameMapper(
		(compilerOptions as { paths?: Record<string, string[]> }).paths ?? {},
		{ prefix: '<rootDir>/' },
	),
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default base
