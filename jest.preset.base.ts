// jest.preset.base.ts
import type { Config } from 'jest'
import { pathsToModuleNameMapper } from 'ts-jest'
import { compilerOptions } from './tsconfig.json'

const preset: Config = {
	testEnvironment: 'node',
	transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	moduleNameMapper: pathsToModuleNameMapper(
		(compilerOptions as { paths?: Record<string, string[]> }).paths ?? {},
		{ prefix: '<rootDir>/' },
	),
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default preset
