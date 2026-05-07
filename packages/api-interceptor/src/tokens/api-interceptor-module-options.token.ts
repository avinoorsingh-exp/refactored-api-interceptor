/**
 * Resolved options for {@link ApiInterceptor}.
 * @internal
 */
export const API_INTERCEPTOR_MODULE_OPTIONS = 'API_INTERCEPTOR_MODULE_OPTIONS' as const;

export interface ApiInterceptorModuleRuntimeOptions {
	exchangePayloadMaxBytes: number;
	captureExchangeRequestPayload: boolean;
	captureExchangeResponsePayload: boolean;
}
