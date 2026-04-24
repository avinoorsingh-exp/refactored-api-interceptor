import { Injectable } from '@nestjs/common'
import { AsyncContextStorage } from '@exprealty/cache'
import type {
	ApiMonitoringRequestStore,
	IApiMonitoringAsyncContext,
} from '@exprealty/api-monitoring'

/**
 * Bridges @exprealty/cache AsyncContextStorage to @exprealty/api-monitoring's async context port.
 */
@Injectable()
export class ApiMonitoringCacheAsyncContextAdapter implements IApiMonitoringAsyncContext {
	getStore(): ApiMonitoringRequestStore | undefined {
		return AsyncContextStorage.getStore() as ApiMonitoringRequestStore | undefined
	}

	getCorrelationId(): string | undefined {
		return AsyncContextStorage.getCorrelationId()
	}
}
