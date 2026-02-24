import {
	mapToMinimalAgentResponse,
	MINIMAL_AGENT_FIELDS,
	MINIMAL_AGENT_INCLUDES,
} from './minimal-agent-response.util.js';

describe('minimal-agent-response.util', () => {
	describe('MINIMAL_AGENT_FIELDS', () => {
		it('contains id, firstName, lastName, lifecycleStatus', () => {
			expect(MINIMAL_AGENT_FIELDS).toEqual([
				'id',
				'firstName',
				'lastName',
				'lifecycleStatus',
			]);
		});
	});

	describe('MINIMAL_AGENT_INCLUDES', () => {
		it('contains primaryEmail and primaryAddress', () => {
			expect(MINIMAL_AGENT_INCLUDES).toEqual(['primaryEmail', 'primaryAddress']);
		});
	});

	describe('mapToMinimalAgentResponse', () => {
		it('maps agent with primaryEmail and primaryAddress to minimal shape', () => {
			const agent = {
				id: '38dbcd25-050b-11eb-95a1-f7f5aaadd764',
				firstName: 'eXp',
				lastName: 'Information',
				lifecycleStatus: 'Active',
				primaryEmail: { value: 'exp.information.20242@exprealty.com' },
				primaryAddress: {
					country: { name: 'United States of America' },
					state: { name: 'Washington' },
				},
			};
			const result = mapToMinimalAgentResponse(agent as Record<string, unknown>);
			expect(result).toEqual({
				id: '38dbcd25-050b-11eb-95a1-f7f5aaadd764',
				firstName: 'eXp',
				lastName: 'Information',
				lifecycleStatus: 'Active',
				primaryEmail: { value: 'exp.information.20242@exprealty.com' },
				primaryAddress: {
					country: { name: 'United States of America' },
					state: { name: 'Washington' },
				},
			});
		});

		it('omits primaryEmail when value is missing', () => {
			const agent = {
				id: 'id-1',
				firstName: 'A',
				lastName: 'B',
				lifecycleStatus: 'Active',
			};
			const result = mapToMinimalAgentResponse(agent as Record<string, unknown>);
			expect(result).not.toHaveProperty('primaryEmail');
			expect(result).toEqual({
				id: 'id-1',
				firstName: 'A',
				lastName: 'B',
				lifecycleStatus: 'Active',
			});
		});

		it('omits primaryAddress when country and state names are missing', () => {
			const agent = {
				id: 'id-1',
				firstName: 'A',
				lastName: 'B',
				lifecycleStatus: 'Active',
				primaryAddress: {},
			};
			const result = mapToMinimalAgentResponse(agent as Record<string, unknown>);
			expect(result).not.toHaveProperty('primaryAddress');
		});

		it('includes primaryAddress with only country when state is missing', () => {
			const agent = {
				id: 'id-1',
				firstName: 'A',
				lastName: 'B',
				lifecycleStatus: 'Active',
				primaryAddress: { country: { name: 'Canada' } },
			};
			const result = mapToMinimalAgentResponse(agent as Record<string, unknown>);
			expect(result.primaryAddress).toEqual({ country: { name: 'Canada' } });
		});

		it('defaults lifecycleStatus to Active when missing', () => {
			const agent = {
				id: 'id-1',
				firstName: 'A',
				lastName: 'B',
			};
			const result = mapToMinimalAgentResponse(agent as Record<string, unknown>);
			expect(result.lifecycleStatus).toBe('Active');
		});
	});
});
