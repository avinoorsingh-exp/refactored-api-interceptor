import { Injectable, Inject } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import type { Config } from './configuration.js'

@Injectable()
export class ConfigService {
	private readonly config: Config
	
	constructor(@Inject(NestConfigService) private configService: NestConfigService) {
		// Get the full config object once and cache it
		this.config = this.configService.get<Config>('') as Config || this.buildConfig()
	}

	/* eslint-disable @typescript-eslint/no-unsafe-assignment */
	private buildConfig(): Config {
		// Fallback: build config from individual keys
		const get = (key: string) => this.configService.get(key)
		const getBool = (key: string): boolean => {
			const val = get(key)
			if (typeof val === 'boolean') return val
			return String(val).toLowerCase() === 'true' || val === '1'
		}
		return {
			NODE_ENV: get('NODE_ENV'),
			PORT: get('PORT'),
			LOG_LEVEL: get('LOG_LEVEL'),
			LOG_DIR: get('LOG_DIR'),
			ALLOWED_ORIGINS: get('ALLOWED_ORIGINS'),
			S2S_INTERNAL_KEY: get('S2S_INTERNAL_KEY'),

			DB_HOST: get('DB_HOST'),
			DB_PORT: get('DB_PORT'),
			DB_USERNAME: get('DB_USERNAME'),
			DB_PASSWORD: get('DB_PASSWORD'),
			DB_NAME: get('DB_NAME'),
			DB_SSL: get('DB_SSL'),

			REDIS_URL: get('REDIS_URL'),
			REDIS_TLS: getBool('REDIS_TLS'),

			HMAC_SECRET: get('HMAC_SECRET'),
			HMAC_SECRET_PREVIOUS: get('HMAC_SECRET_PREVIOUS'),

			KMS_KEY_ARN: get('KMS_KEY_ARN'),
			KMS_KEY_REGION: get('KMS_KEY_REGION'),
			KMS_CACHE_TTL_SECONDS: get('KMS_CACHE_TTL_SECONDS'),
			KMS_CACHE_MAX_MESSAGES: get('KMS_CACHE_MAX_MESSAGES'),

			KAFKA_BROKERS: get('KAFKA_BROKERS'),
			KAFKA_CLIENT_ID: get('KAFKA_CLIENT_ID'),
			KAFKA_CONSUMER_GROUP_ID: get('KAFKA_CONSUMER_GROUP_ID'),
			KAFKA_SASL_MECHANISM: get('KAFKA_SASL_MECHANISM'),
			KAFKA_SASL_USERNAME: get('KAFKA_SASL_USERNAME'),
			KAFKA_SASL_PASSWORD: get('KAFKA_SASL_PASSWORD'),
			KAFKA_SSL: get('KAFKA_SSL'),

			PERF_QUERY_MODE: get('PERF_QUERY_MODE'),
			PERF_QUERY_INCLUDE_IN_RESPONSE: get('PERF_QUERY_INCLUDE_IN_RESPONSE'),
			PERF_QUERY_INCLUDE_SQL: get('PERF_QUERY_INCLUDE_SQL'),
			PERF_QUERY_LOG_ALL: get('PERF_QUERY_LOG_ALL'),
			PERF_QUERY_CAPTURE_EXPLAIN: get('PERF_QUERY_CAPTURE_EXPLAIN'),
			PERF_QUERY_SAMPLE_RATE: get('PERF_QUERY_SAMPLE_RATE'),
			PERF_QUERY_ENDPOINT_ALLOWLIST: get('PERF_QUERY_ENDPOINT_ALLOWLIST'),
			PERF_QUERY_SLOW_MS: get('PERF_QUERY_SLOW_MS'),
			PERF_QUERY_CRITICAL_MS: get('PERF_QUERY_CRITICAL_MS'),

			METRICS_EXPORTER_ENDPOINT: get('METRICS_EXPORTER_ENDPOINT'),
			METRICS_EXPORTER_PROTOCOL: get('METRICS_EXPORTER_PROTOCOL'),
			METRICS_EXPORT_INTERVAL_MS: get('METRICS_EXPORT_INTERVAL_MS'),
			METRICS_ENABLE_DIAGNOSTICS: get('METRICS_ENABLE_DIAGNOSTICS'),
			METRICS_DIAGNOSTICS_VERBOSE: get('METRICS_DIAGNOSTICS_VERBOSE'),
			METRICS_EXPORTER_HEADERS: get('METRICS_EXPORTER_HEADERS'),
		} as Config
	}
	 

	get<K extends keyof Config>(key: K): Config[K] {
		return this.config[key]
	}

	getAll(): Config {
		return this.config
	}

	isDevelopment(): boolean {
		return this.config.NODE_ENV === 'dev'
	}

	isProduction(): boolean {
		return this.config.NODE_ENV === 'prod'
	}

	isTest(): boolean {
		return this.config.NODE_ENV === 'test'
	}
}
