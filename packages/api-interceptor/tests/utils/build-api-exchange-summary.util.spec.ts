import { jest, describe, it, expect } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ApiRequestContextService } from '../../src/services/api-request-context.service.js';
import { API_INTERCEPTOR_ASYNC_CONTEXT } from '../../src/interfaces/async-context.port.js';
import { HttpMethod, ApiActorType, ApiErrorClassification } from '../../src/domain/api-interceptor.types.js';
import { buildApiExchangeSummary } from '../../src/utils/build-api-exchange-summary.util.js';

describe('buildApiExchangeSummary', () => {
	it('merges route facts with async store and classifies server errors', async () => {
		const mockAsync = {
			getStore: jest.fn().mockReturnValue({
				correlationId: 'c1',
				timestamp: 1_000,
				actorId: 'a1',
				actorType: ApiActorType.API_KEY,
			}),
			getCorrelationId: jest.fn().mockReturnValue(undefined),
		};
		const module = await Test.createTestingModule({
			providers: [
				ApiRequestContextService,
				{ provide: API_INTERCEPTOR_ASYNC_CONTEXT, useValue: mockAsync },
			],
		}).compile();
		try {
			const ctx = module.get(ApiRequestContextService);

			const summary = buildApiExchangeSummary(ctx, {
				route: '/x',
				method: HttpMethod.GET,
				statusCode: 502,
				latencyMs: 12,
				error: new Error('boom'),
				retryCount: 0,
			});

			expect(summary.correlationId).toBe('c1');
			expect(summary.actorType).toBe(ApiActorType.API_KEY);
			expect(summary.hasError).toBe(true);
			expect(summary.errorClassification).toBe(ApiErrorClassification.SERVER_ERROR);
			expect(summary.stackTrace).toContain('boom');
		} finally {
			await module.close();
		}
	});

	it('uses getCorrelationId when store has no correlationId', async () => {
		const mockAsync = {
			getStore: jest.fn().mockReturnValue({ timestamp: 1 }),
			getCorrelationId: jest.fn().mockReturnValue('shortcut'),
		};
		const module = await Test.createTestingModule({
			providers: [
				ApiRequestContextService,
				{ provide: API_INTERCEPTOR_ASYNC_CONTEXT, useValue: mockAsync },
			],
		}).compile();
		try {
			const ctx = module.get(ApiRequestContextService);

			const summary = buildApiExchangeSummary(ctx, {
				route: '/',
				method: HttpMethod.POST,
				statusCode: 200,
				latencyMs: 1,
				retryCount: 0,
			});

			expect(summary.correlationId).toBe('shortcut');
			expect(summary.hasError).toBe(false);
		} finally {
			await module.close();
		}
	});
});
