import { normalizeRoute } from '../../src/utils/normalize-route.util.js';

describe('normalizeRoute', () => {
	it('should strip query string', () => {
		expect(normalizeRoute('/v1/agents?limit=10')).toBe('/v1/agents');
	});

	it('should return path unchanged when no IDs', () => {
		expect(normalizeRoute('/v1/agents')).toBe('/v1/agents');
		expect(normalizeRoute('/v1/kafka/services')).toBe('/v1/kafka/services');
	});

	it('should replace UUID with :id', () => {
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		expect(normalizeRoute(`/v1/agents/${uuid}`)).toBe('/v1/agents/:id');
	});

	it('should replace multiple UUIDs with :id', () => {
		const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
		const uuid2 = '660e8400-e29b-41d4-a716-446655440001';
		expect(normalizeRoute(`/v1/agents/${uuid1}/licenses/${uuid2}`)).toBe(
			'/v1/agents/:id/licenses/:id',
		);
	});

	it('should replace numeric path segments with :id', () => {
		expect(normalizeRoute('/v1/countries/123')).toBe('/v1/countries/:id');
		expect(normalizeRoute('/v1/agents/456/addresses/789')).toBe(
			'/v1/agents/:id/addresses/:id',
		);
	});

	it('should handle empty or slash', () => {
		expect(normalizeRoute('')).toBe('/');
		expect(normalizeRoute('/')).toBe('/');
	});
});
