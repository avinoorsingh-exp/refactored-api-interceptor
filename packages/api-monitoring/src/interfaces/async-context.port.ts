import type { ApiActorType } from '../domain/api-monitoring.types.js';

/**
 * Async-local request store shape used by API monitoring (host may map from its own ALS).
 * @public
 */
export interface ApiMonitoringRequestStore {
	correlationId: string;
	userId?: string;
	requestPath?: string;
	method?: string;
	ip?: string;
	timestamp: number;
	actorId?: string;
	actorType?: ApiActorType;
	/** Set when {@link ApiMonitoringUserEntity} row exists for the current USER actor. */
	monitoringUserId?: string;
	startTime?: number;
}

/**
 * Port for reading correlation / request context without depending on a specific cache package.
 * @public
 */
export interface IApiMonitoringAsyncContext {
	/** Active request bag (ALS); monitoring reads actor/correlation from here. */
	getStore(): ApiMonitoringRequestStore | undefined;
	/** Shortcut when correlation lives outside the store shape. */
	getCorrelationId(): string | undefined;
}

/** Nest DI token for {@link IApiMonitoringAsyncContext}. */
export const API_MONITORING_ASYNC_CONTEXT = Symbol('API_MONITORING_ASYNC_CONTEXT');
