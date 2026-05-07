import type { ApiExchangeEvent } from '../domain/api-exchange.event.js';

/**
 * Optional host notifier: receives every observed HTTP exchange (success, error, or skipped).
 * @public
 */
export const API_MONITORING_ON_EXCHANGE = 'API_MONITORING_ON_EXCHANGE' as const;

export type ApiExchangeHandler = (event: ApiExchangeEvent) => void | Promise<void>;
