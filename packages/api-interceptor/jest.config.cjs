/** @type {import('jest').Config} */
module.exports = {
	displayName: 'api-interceptor-unit',
	testEnvironment: 'node',
	rootDir: '.',
	injectGlobals: true,
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: '<rootDir>/tsconfig.json',
			},
		],
	},
	testMatch: ['<rootDir>/tests/**/*.spec.ts'],
	setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.cjs'],
	collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
	coverageThreshold: {
		global: {
			lines: 50,
			statements: 48,
			branches: 37,
			functions: 30,
		},
	},
};
