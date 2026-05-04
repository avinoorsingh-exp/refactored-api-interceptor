/**
 * Resolved options for {@link ApiMonitoringModule} (injected into the interceptor).
 * @internal
 */
export const API_MONITORING_MODULE_OPTIONS = 'API_MONITORING_MODULE_OPTIONS' as const;

export interface ApiMonitoringModuleRuntimeOptions {
	captureRequestBody: boolean;
	requestBodyMaxBytes: number;
}
