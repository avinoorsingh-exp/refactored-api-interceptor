/**
 * Agents-only baseline scenario — steady-state performance measurement.
 *
 * Weighted distribution of includes, search modes, and fields projection.
 * Each VU iteration gets a different combination.
 *
 * Override via env vars: PAGE_SIZE_SET, SEARCH_MODE, SEARCH_TERMS,
 *   INCLUDES, INCLUDES_WEIGHTS, SEARCH_WEIGHTS, FIELDS_MODE,
 *   FIELDS_WEIGHTS, FIELDS_COUNT_SET, FILTERS, AGENTS_*
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 pnpm loadtest:agents:baseline
 */
import { baselineProfile } from '../lib/k6-constants.js';
import { baselineParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';

export const options = {
	scenarios: {
		'agents-baseline': {
			executor: 'ramping-vus',
			stages: baselineProfile.stages,
			tags: { scenario: 'agents-baseline' },
		},
	},
	thresholds: baselineProfile.thresholds,
	summaryTrendStats: baselineProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(baselineParams('agents'));
}
