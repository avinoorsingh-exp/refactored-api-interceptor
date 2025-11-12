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
	DB_SSL: z.coerce.boolean().default(false),

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
 * - AWS (dev/test/prod): Loads from AWS Secrets Manager at {NODE_ENV}/{AWS_SECRET_KEY}
 * 
 * ECS Task Definition should set:
 * - NODE_ENV: dev|test|prod
 * - AWS_SECRET_KEY: agent-service-dev (e.g., dev/agent-service-dev in Secrets Manager)
 * - AWS_REGION: us-east-1 (optional, defaults to us-east-1)
 * 
 * CRITICAL: Configuration errors are logged to console.error here
 * These errors will appear in CloudWatch Logs and should trigger Datadog alerts
 * Check for [Config] prefixed error messages in CloudWatch
 */
export default async () => {
	try {
		const config = await loadConfig(ConfigSchema, {
			extraEnvFile: '.env.agentservice',
		})
		
		return config
	} catch (error) {
		// Log structured error details for CloudWatch/Datadog alerting
		console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
		console.error('CRITICAL: Configuration Loading Failed')
		console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
		console.error('Service: agent-service')
		console.error(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`)
		console.error(`AWS_SECRET_KEY: ${process.env.AWS_SECRET_KEY || 'undefined'}`)
		console.error(`AWS_REGION: ${process.env.AWS_REGION || 'undefined'}`)
		console.error('Error Details:', error)
		console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
		
		// Re-throw to prevent service startup with invalid configuration
		throw error
	}
}