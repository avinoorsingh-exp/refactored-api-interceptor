/**
 * Resolved options for {@link ApiMonitoringInterceptor}.
 * @internal
 */
export const API_MONITORING_MODULE_OPTIONS = 'API_MONITORING_MODULE_OPTIONS' as const;

export interface ApiMonitoringModuleRuntimeOptions {
	exchangePayloadMaxBytes: number;
	captureExchangeRequestPayload: boolean;
	captureExchangeResponsePayload: boolean;
}
