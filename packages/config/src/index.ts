import { config as dotenvConfig } from 'dotenv'
import { expand } from 'dotenv-expand'
import { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'

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
	NODE_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
	LOG_LEVEL: z.string().default('info'),
	LOG_DIR: z.string().default('./logs'),
})

/**
 * Validate process.env against a schema.
 * Returns the typed config and caches it by schema instance to avoid re-parsing.
 */
const cache = new WeakMap<z.ZodTypeAny, unknown>()

export function loadConfig<TOutput>(
	schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>,
	opts?: EnvLoadOptions,
): TOutput {
	const cached = cache.get(schema)
	if (cached !== undefined) {
		return cached as TOutput
	}

	// Load env files prior to parsing
	loadEnv(opts)

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
