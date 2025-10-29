## 🎯 Usage in BatchData Service

Now you can use it in your batchdata service:

### Step 1: Update `services/batchdata/package.json`

```json
{
	"dependencies": {
		"@exprealty/cache": "workspace:*"
		// ... other deps
	}
}
```

### Step 2: Create cache module in batchdata service

```typescript
// services/batchdata/src/cache/cache.module.ts
import { Module } from '@nestjs/common'
import { CacheModule as exprealtyCacheModule } from '@exprealty/cache/nestjs'
import { ConfigService } from '../config/config.service.js'

@Module({
	imports: [
		exprealtyCacheModule.forRootAsync({
			isGlobal: true, // Available everywhere
			useFactory: (configService: ConfigService) => {
				const cfg = configService.getAll()
				return {
					redisUrl: cfg.REDIS_URL,
					redisPassword: cfg.REDIS_PASSWORD,
					redisTls: cfg.REDIS_TLS,
					keyPrefix: 'batchdata',
					defaultTTL: 3600,
				}
			},
			inject: [ConfigService],
		}),
	],
})
export class CacheModule {}
```

### Step 3: Use in your services

```typescript
// services/batchdata/src/modules/property/property.service.ts
import { Injectable } from '@nestjs/common'
import { CacheProvider } from '@exprealty/cache/nestjs'
import { CACHE_TTL } from '@exprealty/shared-domain/batchdata/constants'

@Injectable()
export class PropertyService {
	constructor(private readonly cache: CacheProvider) {}

	async getPropertyDetails(address: string) {
		const cacheKey = `property:details:${address}`

		return this.cache.getOrSet(
			cacheKey,
			async () => {
				// Call BatchData API
				return await this.batchDataClient.getPropertyDetails(address)
			},
			CACHE_TTL.PROPERTY_DETAILS, // 24 hours
		)
	}
}
```

---

## ✅ Summary

The `@exprealty/cache` package provides:

1. **Framework-agnostic core** - Can be used in any Node.js project
2. **NestJS integration** - Module and provider for DI
3. **Type-safe** - Full TypeScript support
4. **Production-ready** - Error handling, logging, health checks
5. **Reusable** - Can be published as npm package later

This follows the exact same pattern as your `@exprealty/logger` package! 🎉
