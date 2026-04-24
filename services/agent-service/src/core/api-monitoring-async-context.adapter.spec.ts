import { AsyncContextStorage } from '@exprealty/cache';
import { ApiMonitoringCacheAsyncContextAdapter } from './api-monitoring-async-context.adapter.js';

describe('ApiMonitoringCacheAsyncContextAdapter', () => {
	let adapter: ApiMonitoringCacheAsyncContextAdapter;

	beforeEach(() => {
		adapter = new ApiMonitoringCacheAsyncContextAdapter();
		jest.restoreAllMocks();
	});

	it('getStore returns AsyncContextStorage.getStore() cast for monitoring', () => {
		const store = { correlationId: 'corr-1', timestamp: 1 };
		jest.spyOn(AsyncContextStorage, 'getStore').mockReturnValue(store as never);
		expect(adapter.getStore()).toBe(store);
	});

	it('getStore returns undefined when ALS has no store', () => {
		jest.spyOn(AsyncContextStorage, 'getStore').mockReturnValue(undefined);
		expect(adapter.getStore()).toBeUndefined();
	});

	it('getCorrelationId delegates to AsyncContextStorage.getCorrelationId', () => {
		jest.spyOn(AsyncContextStorage, 'getCorrelationId').mockReturnValue('cid-99');
		expect(adapter.getCorrelationId()).toBe('cid-99');
	});

	it('getCorrelationId returns undefined when not in a context', () => {
		jest.spyOn(AsyncContextStorage, 'getCorrelationId').mockReturnValue(undefined);
		expect(adapter.getCorrelationId()).toBeUndefined();
	});
});
