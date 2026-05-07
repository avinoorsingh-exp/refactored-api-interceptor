/**
 * Verifies the package entry re-exports what consumers need to wire interception.
 */
import * as Esm from '../../src/index.js';

describe('public package surface (index)', () => {
	it('exports the module, interceptor, context, and exchange types', () => {
		expect(Esm.ApiMonitoringModule).toBeDefined();
		expect(Esm.ApiMonitoringModule.forRoot).toBeInstanceOf(Function);
		expect(Esm.ApiMonitoringInterceptor).toBeDefined();
		expect(Esm.ApiRequestContextService).toBeDefined();
		expect(Esm.API_MONITORING_ASYNC_CONTEXT).toBeDefined();
		expect(Esm.API_MONITORING_ON_EXCHANGE).toBeDefined();
		expect(Esm.API_MONITORING_SOURCE_APP_HEADER).toBe('x-source-app');
		expect(Esm.parseSourceApplicationHeader).toBeInstanceOf(Function);
		expect(Esm.API_MONITORING_RETRY_COUNT_HEADER).toBe('x-retry-count');
		expect(Esm.parseRetryCountHeader).toBeInstanceOf(Function);
		expect(Esm.HttpMethod).toBeDefined();
		expect(Esm.ApiActorType).toBeDefined();
		expect(Esm.ApiErrorClassification).toBeDefined();
	});
});
