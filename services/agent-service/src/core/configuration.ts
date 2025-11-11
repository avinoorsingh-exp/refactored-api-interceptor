import { z } from 'zod'
import { BaseConfig, loadConfig } from '@exprealty/config'

/**
 * Configuration schema for BatchData service
 * Uses Zod for runtime validation
 *
 * ⚠️ IMPORTANT: This is the ONLY place (besides @exprealty/config) that accesses process.env
 * All other code should use ConfigService.get() to access configuration values
 */
export const ConfigSchema = BaseConfig.extend({
	// ===== Application =====
	PORT: z.coerce.number().default(3000),
	ALLOWED_ORIGINS: z.string().optional().default('*'),

	// ===== Database =====
	DB_HOST: z.string(),
	DB_PORT: z.coerce.number(),
	DB_USERNAME: z.string(),
	DB_PASSWORD: z.string(),
	DB_NAME: z.string(),

	// ===== Internal Service-to-Service Auth =====
	S2S_INTERNAL_KEY: z.string().optional(),

	// ==================== Metrics Config ====================
	METRICS_EXPORTER_ENDPOINT: z.string().optional(),
	METRICS_EXPORTER_PROTOCOL: z.enum(['http', 'grpc']).default('http'),
	METRICS_EXPORT_INTERVAL_MS: z.coerce.number().default(10000),
	METRICS_ENABLE_DIAGNOSTICS: z.coerce.boolean().default(false),
	METRICS_DIAGNOSTICS_VERBOSE: z.coerce.boolean().default(false),
	
	// For authentication to backends (e.g., Datadog API key)
	METRICS_EXPORTER_HEADERS: z.string().optional(), // JSON string of headers
})

export type Config = z.infer<typeof ConfigSchema>

/**
 * Configuration loader function for NestJS ConfigModule
 * Uses @exprealty/config for env file loading and validation
 * 
 * The config package automatically handles:
 * - Local: Loads from .env files
 * - AWS (dev/test/prod): Loads from AWS Secrets Manager at {NODE_ENV}/{AWS_SECRET_KEY}/config
 * 
 * ECS Task Definition should set:
 * - NODE_ENV: dev|test|prod
 * - AWS_SECRET_KEY: agent-platform (or whatever DevOps configured)
 * - AWS_REGION: us-east-1 (optional, defaults to us-east-1)
 */
export default async () => {
	try {
		const config = await loadConfig(ConfigSchema, {
			extraEnvFile: '.env.agent',
		})
		
		return config
	} catch (error) {
		console.error('[configuration()] FAILED to load config:', error);
		throw error;
	}
}