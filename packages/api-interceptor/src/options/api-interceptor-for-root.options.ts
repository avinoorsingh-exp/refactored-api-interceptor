import type { Type } from '@nestjs/common';
import type { ApiExchangeEvent } from '../domain/api-exchange.event.js';
import type { IApiInterceptorAsyncContext } from '../interfaces/async-context.port.js';

/**
 * Options for {@link ApiInterceptorModule.forRoot}.
 * @public
 */
export interface ApiInterceptorForRootOptions {
	/** Adapter that bridges your async context (e.g. ALS) for correlation and optional actor fields. */
	asyncContext: Type<IApiInterceptorAsyncContext>;

	/**
	 * Called for every observed HTTP exchange (and skipped internal traffic when applicable).
	 * Must not throw; failures are swallowed so requests are unaffected.
	 */
	onApiExchange: (event: ApiExchangeEvent) => void | Promise<void>;

	/**
	 * Max UTF-8 / binary preview for structured request and response body captures.
	 * @default 16384 (clamped 256–1_048_576)
	 */
	exchangePayloadMaxBytes?: number;

	/** When false, omits structured request `body` on events. @default true */
	captureExchangeRequestPayload?: boolean;

	/** When false, omits structured response `body` on events. @default true */
	captureExchangeResponsePayload?: boolean;
}
