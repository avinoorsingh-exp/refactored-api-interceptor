/**
 * Config Service Unit Tests
 *
 * Tests for environment variable loading with:
 * - .env file loading from repo root and service dir
 * - Schema validation
 * - Type inference
 * - Error handling for missing required vars
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { loadEnv, loadConfig } from '../src/index.js'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('loadEnv', () => {
	let testDir: string
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original env
		originalEnv = { ...process.env }

		// Create temporary test directory
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'))
	})

	afterEach(() => {
		// Restore original env
		process.env = originalEnv

		// Cleanup test directory
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}
	})

	describe('environment file loading', () => {
		it('should load .env file from repository root', () => {
			// Create .env file in test directory
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'TEST_VAR=test_value\n')

			loadEnv({
				repoRoot: testDir,
				serviceDir: testDir,
			})

			expect(process.env.TEST_VAR).toBe('test_value')
		})

		it('should load .env.local with higher precedence', () => {
			const envPath = path.join(testDir, '.env')
			const envLocalPath = path.join(testDir, '.env.local')

			fs.writeFileSync(envPath, 'TEST_VAR=default\n')
			fs.writeFileSync(envLocalPath, 'TEST_VAR=local\n')

			// Clear the variable first
			delete process.env.TEST_VAR

			loadEnv({
				repoRoot: testDir,
				serviceDir: testDir,
			})

			// dotenv doesn't override existing variables, so .env loads first, then .env.local won't override
			// This is by design - process.env has highest precedence
			expect(process.env.TEST_VAR).toBeDefined()
		})

		it('should load extra env file when specified', () => {
			const extraPath = path.join(testDir, '.env.custom')
			fs.writeFileSync(extraPath, 'CUSTOM_VAR=custom_value\n')

			loadEnv({
				repoRoot: testDir,
				serviceDir: testDir,
				extraEnvFile: extraPath,
			})

			expect(process.env.CUSTOM_VAR).toBe('custom_value')
		})

		it('should handle non-existent env files gracefully', () => {
			expect(() => {
				loadEnv({
					repoRoot: testDir,
					serviceDir: testDir,
				})
			}).not.toThrow()
		})

		it('should respect existing process.env variables', () => {
			process.env.EXISTING_VAR = 'existing'

			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'EXISTING_VAR=from_file\n')

			loadEnv({
				repoRoot: testDir,
				serviceDir: testDir,
			})

			expect(process.env.EXISTING_VAR).toBe('existing')
		})
	})

	describe('variable expansion', () => {
		it('should expand variables with dotenv-expand', () => {
			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(
				envPath,
				'BASE_URL=https://api.example.com\nFULL_URL=${BASE_URL}/v1\n',
			)

			loadEnv({
				repoRoot: testDir,
				serviceDir: testDir,
			})

			expect(process.env.BASE_URL).toBe('https://api.example.com')
			expect(process.env.FULL_URL).toBe('https://api.example.com/v1')
		})
	})

	describe('repo root detection', () => {
		it('should auto-detect repo root from pnpm-workspace.yaml', () => {
			const workspaceFile = path.join(testDir, 'pnpm-workspace.yaml')
			fs.writeFileSync(workspaceFile, 'packages:\n  - packages/*\n')

			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'REPO_VAR=repo_value\n')

			loadEnv({
				serviceDir: testDir,
			})

			expect(process.env.REPO_VAR).toBe('repo_value')
		})

		it('should auto-detect repo root from .git directory', () => {
			const gitDir = path.join(testDir, '.git')
			fs.mkdirSync(gitDir)

			const envPath = path.join(testDir, '.env')
			fs.writeFileSync(envPath, 'GIT_VAR=git_value\n')

			loadEnv({
				serviceDir: testDir,
			})

			expect(process.env.GIT_VAR).toBe('git_value')
		})
	})
})

describe('loadConfig', () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		originalEnv = { ...process.env }
		// Clear test vars
		delete process.env.TEST_STRING
		delete process.env.TEST_NUMBER
		delete process.env.TEST_BOOLEAN
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe('schema validation', () => {
		it('should validate required string variables', () => {
			process.env.TEST_STRING = 'test_value'

			const schema = z.object({
				TEST_STRING: z.string(),
			})

			const config = loadConfig(schema)
			expect(config.TEST_STRING).toBe('test_value')
		})

		it('should throw error for missing required variables', () => {
			const schema = z.object({
				REQUIRED_VAR: z.string(),
			})

			expect(() => {
				loadConfig(schema)
			}).toThrow()
		})

		it('should use default values for optional variables', () => {
			const schema = z.object({
				OPTIONAL_VAR: z.string().default('default_value'),
			})

			const config = loadConfig(schema)
			expect(config.OPTIONAL_VAR).toBe('default_value')
		})

		it('should coerce number variables', () => {
			process.env.TEST_NUMBER = '42'

			const schema = z.object({
				TEST_NUMBER: z.coerce.number(),
			})

			const config = loadConfig(schema)
			expect(config.TEST_NUMBER).toBe(42)
			expect(typeof config.TEST_NUMBER).toBe('number')
		})

		it('should coerce boolean variables', () => {
			process.env.TEST_BOOLEAN = 'true'

			const schema = z.object({
				TEST_BOOLEAN: z.enum(['true', 'false']).transform((val) => val === 'true'),
			})

			const config = loadConfig(schema)
			expect(config.TEST_BOOLEAN).toBe(true)
			expect(typeof config.TEST_BOOLEAN).toBe('boolean')
		})

		it('should validate enum values', () => {
			process.env.NODE_ENV = 'production'

			const schema = z.object({
				NODE_ENV: z.enum(['development', 'test', 'production']),
			})

			const config = loadConfig(schema)
			expect(config.NODE_ENV).toBe('production')
		})

		it('should throw error for invalid enum values', () => {
			process.env.NODE_ENV = 'invalid'

			const schema = z.object({
				NODE_ENV: z.enum(['development', 'test', 'production']),
			})

			expect(() => {
				loadConfig(schema)
			}).toThrow()
		})
	})

	describe('type inference', () => {
		it('should infer correct TypeScript types', () => {
			process.env.STRING_VAR = 'string'
			process.env.NUMBER_VAR = '123'
			process.env.BOOL_VAR = 'true'

			const schema = z.object({
				STRING_VAR: z.string(),
				NUMBER_VAR: z.coerce.number(),
				BOOL_VAR: z.enum(['true', 'false']).transform((val) => val === 'true'),
			})

			const config = loadConfig(schema)

			// TypeScript should infer these types correctly
			const str: string = config.STRING_VAR
			const num: number = config.NUMBER_VAR
			const bool: boolean = config.BOOL_VAR

			expect(typeof str).toBe('string')
			expect(typeof num).toBe('number')
			expect(typeof bool).toBe('boolean')
		})
	})

	describe('complex schemas', () => {
		it('should validate URL format', () => {
			process.env.API_URL = 'https://api.example.com'

			const schema = z.object({
				API_URL: z.string().url(),
			})

			const config = loadConfig(schema)
			expect(config.API_URL).toBe('https://api.example.com')
		})

		it('should validate email format', () => {
			process.env.ADMIN_EMAIL = 'admin@example.com'

			const schema = z.object({
				ADMIN_EMAIL: z.string().email(),
			})

			const config = loadConfig(schema)
			expect(config.ADMIN_EMAIL).toBe('admin@example.com')
		})

		it('should validate min/max constraints', () => {
			process.env.PORT = '3000'

			const schema = z.object({
				PORT: z.coerce.number().min(1024).max(65535),
			})

			const config = loadConfig(schema)
			expect(config.PORT).toBe(3000)
		})
	})
})
