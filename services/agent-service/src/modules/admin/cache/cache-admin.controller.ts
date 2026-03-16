import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CacheService } from '@exprealty/cache'
import { CountCacheService } from '../../../common/pagination/count-cache.service.js'

@ApiTags('Admin - Cache')
@Controller('v1/admin/cache')
export class CacheAdminController {
	constructor(
		private readonly cache: CacheService,
		private readonly countCache: CountCacheService,
	) {}

	@Get('stats')
	@ApiOperation({ summary: 'Get cache statistics (Redis + in-process LRU)' })
	@ApiResponse({ status: 200, description: 'Cache statistics returned' })
	async getStats() {
		const [redisStats, countCacheStats] = await Promise.all([
			this.cache.getStats(),
			this.countCache.getStats(),
		])

		return {
			redis: {
				connected: redisStats.connected,
				keyCount: redisStats.keys,
				memoryUsage: redisStats.memory,
				uptimeSeconds: redisStats.uptime,
			},
			countCache: {
				lruSize: countCacheStats.lruSize,
				pendingBackgroundJobs: countCacheStats.pendingJobs,
				activeBackgroundCounts: countCacheStats.activeBackgroundCounts,
			},
		}
	}
}
