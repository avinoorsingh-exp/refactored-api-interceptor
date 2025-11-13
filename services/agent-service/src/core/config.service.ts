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

			METRICS_EXPORTER_ENDPOINT: get('METRICS_EXPORTER_ENDPOINT'),
			METRICS_EXPORTER_PROTOCOL: get('METRICS_EXPORTER_PROTOCOL'),
			METRICS_EXPORT_INTERVAL_MS: get('METRICS_EXPORT_INTERVAL_MS'),
			METRICS_ENABLE_DIAGNOSTICS: get('METRICS_ENABLE_DIAGNOSTICS'),
			METRICS_DIAGNOSTICS_VERBOSE: get('METRICS_DIAGNOSTICS_VERBOSE'),
			METRICS_EXPORTER_HEADERS: get('METRICS_EXPORTER_HEADERS'),
		} as Config
	}
	/* eslint-disable @typescript-eslint/no-unsafe-assignment */

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
