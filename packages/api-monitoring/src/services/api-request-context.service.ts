import { Inject, Injectable } from '@nestjs/common';
import type { ApiActorType } from '../domain/api-monitoring.types.js';
import type { ApiMonitoringRequestStore } from '../interfaces/async-context.port.js';
import {
	API_MONITORING_ASYNC_CONTEXT,
	type IApiMonitoringAsyncContext,
} from '../interfaces/async-context.port.js';

/**
 * Extended request context for API monitoring.
 */
interface ApiRequestContext extends ApiMonitoringRequestStore {
	actorId?: string;
	actorType?: ApiActorType;
	startTime?: number;
}

/**
 * Service for managing API request context with actor attribution.
 * @public
 */
@Injectable()
export class ApiRequestContextService {
	constructor(
		@Inject(API_MONITORING_ASYNC_CONTEXT)
		private readonly asyncContext: IApiMonitoringAsyncContext,
	) {}

	getContext(): ApiRequestContext | undefined {
		return this.asyncContext.getStore() as ApiRequestContext | undefined;
	}

	getCorrelationId(): string | undefined {
		return this.asyncContext.getCorrelationId();
	}

	getActorId(): string | undefined {
		return this.getContext()?.actorId;
	}

	getActorType(): ApiActorType | undefined {
		return this.getContext()?.actorType;
	}

	updateActor(actorId: string, actorType: ApiActorType): void {
		const context = this.getContext();
		if (context) {
			context.actorId = actorId;
			context.actorType = actorType;
		}
	}

	setStartTime(): void {
		const context = this.getContext();
		if (context) {
			context.startTime = Date.now();
		}
	}

	getStartTime(): number | undefined {
		return this.getContext()?.startTime;
	}
}
