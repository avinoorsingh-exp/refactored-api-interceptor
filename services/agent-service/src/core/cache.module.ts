import { Global, Module } from '@nestjs/common'
import { CacheService } from '@exprealty/cache'
import { ConfigService } from './config.service.js'
import { LoggerService } from './logger.service.js'

@Global()
@Module({
	providers: [
		{
			provide: CacheService,
			useFactory: (config: ConfigService, loggerService: LoggerService) => {
				// Lazy proxy: _winston is null at factory time (before onModuleInit),
				// but ioredis events fire asynchronously after bootstrap when it's ready.
				/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- Winston surface proxied until LoggerService finishes init */
				const lazyLogger = new Proxy({} as any, {
					get: (_target, prop) => {
						const winston = loggerService._winston
						if (winston && typeof winston[prop as string] === 'function') {
							return winston[prop as string].bind(winston)
						}
						// Console fallback during bootstrap
						if (prop === 'info') return console.log.bind(console, '[CacheService]')
						if (prop === 'error') return console.error.bind(console, '[CacheService]')
						if (prop === 'warn') return console.warn.bind(console, '[CacheService]')
						if (prop === 'debug') return console.debug.bind(console, '[CacheService]')
						return undefined
					},
				})
				const redisUrl = config.get('REDIS_URL')
				const service = new CacheService({
					redisUrl,
					redisTls: config.get('REDIS_TLS'),
					keyPrefix: 'exprealty:agentdb',
					logger: lazyLogger,
					enabled: !!redisUrl,
				})
				/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
				return service
			},
			inject: [ConfigService, LoggerService],
		},
	],
	exports: [CacheService],
})
export class CacheProviderModule {}
