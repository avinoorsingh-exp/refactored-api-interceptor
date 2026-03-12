import { Global, Module } from '@nestjs/common'
import { CacheService } from '@exprealty/cache'
import { ConfigService } from './config.service.js'

@Global()
@Module({
	providers: [
		{
			provide: CacheService,
			useFactory: (config: ConfigService) => {
				return new CacheService({
					redisUrl: config.get('REDIS_URL'),
					redisTls: config.get('REDIS_TLS'),
					keyPrefix: 'exprealty:agentdb',
				})
			},
			inject: [ConfigService],
		},
	],
	exports: [CacheService],
})
export class CacheProviderModule {}
