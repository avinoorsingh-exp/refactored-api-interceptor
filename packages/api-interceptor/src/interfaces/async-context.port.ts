import type { ApiActorType } from '../domain/api-interceptor.types.js';

/**
 * Async-local request store shape used by the interceptor (host may map from its own ALS).
 * @public
 */
export interface ApiInterceptorRequestStore {
	correlationId: string;
	userId?: string;
	requestPath?: string;
	method?: string;
	ip?: string;
	timestamp: number;
	actorId?: string;
	actorType?: ApiActorType;
	/** Optional id from the host (e.g. profile key) when you populate the store. */
	monitoringUserId?: string;
	startTime?: number;
}

/**
 * Port for reading correlation / request context without depending on a specific cache package.
 * @public
 */
export interface IApiInterceptorAsyncContext {
	/** Active request bag (ALS); the interceptor reads actor/correlation from here. */
	getStore(): ApiInterceptorRequestStore | undefined;
	/** Shortcut when correlation lives outside the store shape. */
	getCorrelationId(): string | undefined;
}

/** Nest DI token for {@link IApiInterceptorAsyncContext}. */
export const API_INTERCEPTOR_ASYNC_CONTEXT = Symbol('API_INTERCEPTOR_ASYNC_CONTEXT');
