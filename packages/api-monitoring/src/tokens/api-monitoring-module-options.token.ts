/**
 * Resolved options for {@link ApiMonitoringModule} (injected into the interceptor).
 * @internal
 */
export const API_MONITORING_MODULE_OPTIONS = 'API_MONITORING_MODULE_OPTIONS' as const;

export interface ApiMonitoringModuleRuntimeOptions {
	captureRequestBody: boolean;
	requestBodyMaxBytes: number;
	/**
	 * When true, each HTTP response may include `x-api-monitoring-request-log-*` headers describing
	 * whether a row was written to `api_request_log` (and why not, if skipped or errored).
	 * @default true (set to false to hide from clients or strict proxies)
	 */
	exposeRequestLogOutcomeHeaders: boolean;
}
