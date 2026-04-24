import {
	API_MONITORING_ACTOR_REPO,
	API_MONITORING_REQUEST_LOG_REPO,
	API_MONITORING_ROUTE_STATS_REPO,
} from '../../src/tokens/repository.tokens.js';
import { API_MONITORING_ENTITY_CLASSES } from '../../src/tokens/entity-classes.token.js';
import { API_MONITORING_ASYNC_CONTEXT } from '../../src/interfaces/async-context.port.js';

describe('API monitoring DI tokens (Strategy 1)', () => {
	it('uses distinct symbols for repository ports', () => {
		const tokens = new Set([
			API_MONITORING_REQUEST_LOG_REPO,
			API_MONITORING_ROUTE_STATS_REPO,
			API_MONITORING_ACTOR_REPO,
		]);
		expect(tokens.size).toBe(3);
	});

	it('uses a distinct symbol for entity class bundle', () => {
		expect(API_MONITORING_ENTITY_CLASSES).not.toBe(API_MONITORING_REQUEST_LOG_REPO);
		expect(API_MONITORING_ENTITY_CLASSES).not.toBe(API_MONITORING_ASYNC_CONTEXT);
	});
});
