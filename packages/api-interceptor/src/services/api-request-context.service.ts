import { Inject, Injectable } from '@nestjs/common';
import type { ApiActorType } from '../domain/api-interceptor.types.js';
import type { ApiInterceptorRequestStore } from '../interfaces/async-context.port.js';
import {
	API_INTERCEPTOR_ASYNC_CONTEXT,
	type IApiInterceptorAsyncContext,
} from '../interfaces/async-context.port.js';

/**
 * Extended request context for the interceptor.
 */
interface ApiRequestContext extends ApiInterceptorRequestStore {
	actorId?: string;
	actorType?: ApiActorType;
	monitoringUserId?: string;
	startTime?: number;
}

/**
 * Service for managing API request context with actor attribution.
 * @public
 */
@Injectable()
export class ApiRequestContextService {
	constructor(
		@Inject(API_INTERCEPTOR_ASYNC_CONTEXT)
		private readonly asyncContext: IApiInterceptorAsyncContext,
	) {}

	/** Current ALS/request store for this HTTP call, if any. */
	getContext(): ApiRequestContext | undefined {
		return this.asyncContext.getStore();
	}

	/** Correlation id from the host async context (shortcut). */
	getCorrelationId(): string | undefined {
		return this.asyncContext.getCorrelationId();
	}

	/** Actor id from store (set by middleware). */
	getActorId(): string | undefined {
		return this.getContext()?.actorId;
	}

	/** Actor type from store. */
	getActorType(): ApiActorType | undefined {
		return this.getContext()?.actorType;
	}

	/** Writes actor id/type into the async store for downstream logging. */
	updateActor(actorId: string, actorType: ApiActorType): void {
		const context = this.getContext();
		if (context) {
			context.actorId = actorId;
			context.actorType = actorType;
		}
	}

	/** Links an optional user/profile id on the store (host-defined). */
	updateMonitoringUser(monitoringUserId: string): void {
		const context = this.getContext();
		if (context) {
			context.monitoringUserId = monitoringUserId;
		}
	}

	/** Marks when request handling started (latency baseline). */
	setStartTime(): void {
		const context = this.getContext();
		if (context) {
			context.startTime = Date.now();
		}
	}

	/** Milliseconds from `setStartTime()`, if set. */
	getStartTime(): number | undefined {
		return this.getContext()?.startTime;
	}
}
