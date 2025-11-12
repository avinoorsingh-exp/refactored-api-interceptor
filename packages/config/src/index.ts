import { config as dotenvConfig } from 'dotenv'
import { expand } from 'dotenv-expand'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import { loadSecretsFromAWS } from './secrets-loader.js'

// Re-export secrets loader for direct use
export { loadSecretsFromAWS, loadMultipleSecrets } from './secrets-loader.js'

/**
 * Loads .env files from:
 *  1) repo root (exprealty/.env*)
 *  2) service dir (e.g., exprealty/services/agent-service/.env*)
 *  3) explicit file passed in (e.g., .env.agent)
 *
 * Order: earlier wins only if keys are not already set.
 * Existing process.env always has highest precedence.
 */
export type EnvLoadOptions = {
	/** Absolute or relative path to an extra env file (e.g., ".env.agent") */
	extraEnvFile?: string
	/** Directory of the service (defaults to process.cwd()) */
	serviceDir?: string
	/** Repository root path (auto-detected relative to serviceDir if not provided) */
	repoRoot?: string
	/** Secret key for AWS Secrets Manager (e.g., 'agent-platform', 'shared-config') - will be combined with NODE_ENV as: {NODE_ENV}/{secretKey}/config */
	secretKey?: string
	/** AWS region for Secrets Manager (defaults to us-east-1) */
	awsRegion?: string
}

function safeExists(p?: string) {
	if (!p) return false
	try {
		fs.accessSync(p)
		return true
	} catch {
		return false
	}
}

function maybeLoad(filePath: string) {
	if (!safeExists(filePath)) return
	const parsed = dotenvConfig({ path: filePath })
	expand(parsed)
}

function detectRepoRoot(startDir: string) {
	// walk up until package.json with "name":"exprealty" or a .git dir is found
	let dir = startDir
	for (let i = 0; i < 6; i++) {
		if (
			safeExists(path.join(dir, '.git')) ||
			safeExists(path.join(dir, 'pnpm-workspace.yaml'))
		) {
			return dir
		}
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return startDir // fallback
}

/** Load env files with sensible defaults */
export function loadEnv(options: EnvLoadOptions = {}) {
	// Only load .env files in local development
	// AWS Secrets Manager will provide environment variables in dev/test/prod
	if (process.env.NODE_ENV !== 'local') {
		return
	}

	const serviceDir = path.resolve(options.serviceDir ?? process.cwd())
	const repoRoot = options.repoRoot ?? detectRepoRoot(serviceDir)

	// 1) repo-level standard files (if you use them)
	for (const filename of ['.env', '.env.local']) {
		maybeLoad(path.join(repoRoot, filename))
	}

	// 2) service-level files
	for (const filename of ['.env', '.env.local']) {
		maybeLoad(path.join(serviceDir, filename))
	}

	// 3) explicit extra file (e.g., ".env.agent")
	if (options.extraEnvFile) {
		const explicitPath = path.isAbsolute(options.extraEnvFile)
			? options.extraEnvFile
			: path.join(repoRoot, options.extraEnvFile)
		maybeLoad(explicitPath)
	}
}

/** Base schema shared by all services */
export const BaseConfig = z.object({
	NODE_ENV: z.enum(['local', 'dev', 'test', 'prod']).default('local'),
	LOG_LEVEL: z.string().default('info'),
	LOG_DIR: z.string().default('./logs'),
	AWS_REGION: z.string().default('us-east-1'),
})

/**
 * Validate process.env against a schema.
 * Returns the typed config and caches it by schema instance to avoid re-parsing.
 * 
 * Automatically handles configuration loading based on NODE_ENV:
 * - local: Loads from .env files
 * - dev/test/prod: Loads from AWS Secrets Manager using convention: {NODE_ENV}/{secretKey}/config
 * 
 * Services only need to specify their secretKey - everything else is automatic.
 */
const cache = new WeakMap<z.ZodTypeAny, unknown>()

export async function loadConfig<TOutput>(
	schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
	opts?: EnvLoadOptions,
): Promise<TOutput> {
	const cached = cache.get(schema)
	if (cached !== undefined) {
		return cached as TOutput
	}

	// Read NODE_ENV directly from process.env to determine loading strategy
	// This is the ONLY place services should access process.env.NODE_ENV
	const env = process.env.NODE_ENV || 'local'

	// Local development: Load from .env files
	if (env === 'local') {
		loadEnv(opts)
	}
	// AWS environments: Load from Secrets Manager automatically
	else {
		
		// AWS_SECRET_KEY should contain the FULL secret name: env/secret-name
		// Default to dev/agent-service-dev for convenience
		const secretName = process.env.AWS_SECRET_KEY || opts?.secretKey || 'dev/agent-service-dev'
		const isDefaultSecret = !process.env.AWS_SECRET_KEY && !opts?.secretKey
		
		const region = process.env.AWS_REGION || opts?.awsRegion || 'us-east-1'
		
		console.log(`[Config] Loading secrets from AWS Secrets Manager:`)
		console.log(`[Config]   NODE_ENV: ${env}`)
		if (isDefaultSecret) {
			console.log(`[Config]   AWS_SECRET_KEY: Not set - defaulting to '${secretName}'`)
			console.log(`[Config]   Set AWS_SECRET_KEY environment variable for non-dev environments`)
			console.log(`[Config]   Format: env/secret-name (e.g., 'qa/agent-service-accp', 'prod/agent-service-prod')`)
		} else {
			console.log(`[Config]   AWS_SECRET_KEY: ${secretName}`)
		}
		console.log(`[Config]   Region: ${region}`)
		
		try {
			await loadSecretsFromAWS(secretName, region)
			console.log(`[Config] Successfully loaded secrets from ${secretName}`)
		} catch (error) {
			// FAIL FAST: Don't swallow AWS errors and continue to Zod validation
			// The AWS error message is much clearer than "DB_HOST is required"
			console.error(`[Config] Failed to load AWS secrets from ${secretName}`)
			console.error(`[Config] Error: ${error instanceof Error ? error.message : String(error)}`)
			console.error(`[Config] Stack: ${error instanceof Error ? error.stack : 'N/A'}`)
			// Re-throw immediately - don't continue to validation with missing secrets
			throw error
		}
	}

	const cfg = schema.parse(process.env)
	cache.set(schema, cfg)
	return cfg
}

/**
 * Synchronous version of loadConfig for backwards compatibility
 * Only works in local mode or when secrets are already in process.env
 * @deprecated Use async loadConfig instead
 */
export function loadConfigSync<TOutput>(
	schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
	opts?: EnvLoadOptions,
): TOutput {
	const cached = cache.get(schema)
	if (cached !== undefined) {
		return cached as TOutput
	}

	// Only load .env files in local mode
	if (process.env.NODE_ENV === 'local') {
		loadEnv(opts)
	}

	const cfg = schema.parse(process.env)
	cache.set(schema, cfg)
	return cfg
}

/** Utility to redact secrets when logging config */
export function redact<T extends Record<string, unknown>>(obj: T, keys: string[] = []) {
	const secretHints = ['SECRET', 'TOKEN', 'PASSWORD', 'KEY']
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(obj)) {
		const isSecret =
			keys.includes(k) || secretHints.some((h) => k.toUpperCase().includes(h))
		out[k] = isSecret ? '***redacted***' : v
	}
	return out as T
}
