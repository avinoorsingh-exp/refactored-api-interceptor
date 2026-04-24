import {
	HttpMethod,
	TimeBucket,
	ApiActorType,
	ApiErrorClassification,
} from '../../src/domain/api-monitoring.types.js';

/**
 * Contract tests: enum string values must stay aligned with DB / shared-domain
 * so host-provided TypeORM entities remain compatible after decoupling.
 */
describe('api-monitoring domain types (Strategy 1)', () => {
	describe('HttpMethod', () => {
		it('uses uppercase HTTP verbs as values', () => {
			expect(HttpMethod.GET).toBe('GET');
			expect(HttpMethod.POST).toBe('POST');
			expect(HttpMethod.PUT).toBe('PUT');
			expect(HttpMethod.PATCH).toBe('PATCH');
			expect(HttpMethod.DELETE).toBe('DELETE');
			expect(HttpMethod.HEAD).toBe('HEAD');
			expect(HttpMethod.OPTIONS).toBe('OPTIONS');
		});
	});

	describe('TimeBucket', () => {
		it('uses minute, hour, day as stored aggregation keys', () => {
			expect(TimeBucket.MINUTE).toBe('minute');
			expect(TimeBucket.HOUR).toBe('hour');
			expect(TimeBucket.DAY).toBe('day');
		});
	});

	describe('ApiActorType', () => {
		it('uses stable snake-case actor kinds', () => {
			expect(ApiActorType.USER).toBe('user');
			expect(ApiActorType.API_KEY).toBe('api_key');
			expect(ApiActorType.SERVICE_ACCOUNT).toBe('service_account');
			expect(ApiActorType.ANONYMOUS).toBe('anonymous');
			expect(ApiActorType.SYSTEM).toBe('system');
		});
	});

	describe('ApiErrorClassification', () => {
		it('uses stable classification keys for persisted logs', () => {
			expect(ApiErrorClassification.CLIENT_ERROR).toBe('client_error');
			expect(ApiErrorClassification.SERVER_ERROR).toBe('server_error');
			expect(ApiErrorClassification.VALIDATION_ERROR).toBe('validation_error');
			expect(ApiErrorClassification.AUTH_ERROR).toBe('auth_error');
			expect(ApiErrorClassification.RATE_LIMIT_ERROR).toBe('rate_limit_error');
			expect(ApiErrorClassification.TIMEOUT_ERROR).toBe('timeout_error');
			expect(ApiErrorClassification.UNKNOWN_ERROR).toBe('unknown_error');
		});
	});
});
