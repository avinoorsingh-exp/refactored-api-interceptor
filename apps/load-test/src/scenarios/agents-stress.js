/**
 * Agents-only stress scenario — ramp to high VUs with worst-case params.
 *
 * Defaults: contains search + heavy includes + largest page size + custom fields.
 * Gates on error rate; latency thresholds are advisory.
 *
 * Override via env vars: PAGE_SIZE_SET, SEARCH_MODE, SEARCH_TERMS,
 *   INCLUDES, FIELDS_MODE, FIELDS_COUNT_SET, FILTERS, AGENTS_*
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 pnpm loadtest:agents:stress
 *
 * Worst-case example:
 *   BASE_URL=http://localhost:3000 SEARCH_MODE=contains INCLUDES=heavy \
 *     FIELDS_MODE=custom PAGE_SIZE_SET=100 pnpm loadtest:agents:stress
 */
import { stressProfile } from '../lib/k6-constants.js';
import { stressParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';

export const options = {
	scenarios: {
		'agents-stress': {
			executor: 'ramping-vus',
			stages: stressProfile.stages,
			tags: { scenario: 'agents-stress' },
		},
	},
	thresholds: stressProfile.thresholds,
	summaryTrendStats: stressProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(stressParams('agents'));
}
