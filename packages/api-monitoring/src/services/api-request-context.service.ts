import { Injectable } from '@nestjs/common';
import { AsyncContextStorage, RequestContext } from '@exprealty/cache';
import { ApiActorType } from '@exprealty/shared-domain';

/**
 * Extended request context for API monitoring.
 * Uses the base RequestContext and stores additional fields via metadata.
 */
interface ApiRequestContext extends RequestContext {
	// Extended fields stored in the context
	actorId?: string;
	actorType?: ApiActorType;
	startTime?: number;
}

/**
 * Service for managing API request context with actor attribution.
 * 
 * Extends the base AsyncContextStorage to include actor information
 * for monitoring and security purposes.
 * 
 * @public
 */
@Injectable()
export class ApiRequestContextService {
	/**
	 * Get the current request context.
	 */
	getContext(): ApiRequestContext | undefined {
		return AsyncContextStorage.getStore() as ApiRequestContext | undefined;
	}

	/**
	 * Get correlation ID from current context.
	 */
	getCorrelationId(): string | undefined {
		return AsyncContextStorage.getCorrelationId();
	}

	/**
	 * Get actor ID from current context.
	 */
	getActorId(): string | undefined {
		return this.getContext()?.actorId;
	}

	/**
	 * Get actor type from current context.
	 */
	getActorType(): ApiActorType | undefined {
		return this.getContext()?.actorType;
	}

	/**
	 * Update the current context with actor information.
	 * This is called by middleware after authentication.
	 */
	updateActor(actorId: string, actorType: ApiActorType): void {
		const context = this.getContext();
		if (context) {
			// Store actor info in context (TypeScript allows this at runtime)
			(context as ApiRequestContext).actorId = actorId;
			(context as ApiRequestContext).actorType = actorType;
		}
	}

	/**
	 * Set request start time for latency calculation.
	 */
	setStartTime(): void {
		const context = this.getContext();
		if (context) {
			// Store start time in context (TypeScript allows this at runtime)
			(context as ApiRequestContext).startTime = Date.now();
		}
	}

	/**
	 * Get request start time.
	 */
	getStartTime(): number | undefined {
		return this.getContext()?.startTime;
	}
}

