/**
 * Baseline scenario — steady-state performance measurement.
 *
 * Uses weighted distribution of includes (none/light/heavy) and search modes
 * (prefix/contains/exact). Each VU iteration gets a different combination,
 * tagged so k6 output shows which variant regressed.
 *
 * Override via env vars: PAGE_SIZE_SET, SEARCH_MODE, SEARCH_TERMS,
 *   INCLUDES, INCLUDES_WEIGHTS, SEARCH_WEIGHTS, FILTERS
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 k6 run src/scenarios/baseline.js
 */
import { baselineProfile } from '../lib/k6-constants.js';
import { baselineParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';
import { listAgentCompanies } from '../agent-companies/journey.js';
import { listCompanies } from '../companies/journey.js';

export const options = {
	scenarios: {
		baseline: {
			executor: 'ramping-vus',
			stages: baselineProfile.stages,
		},
	},
	thresholds: baselineProfile.thresholds,
	summaryTrendStats: baselineProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(baselineParams('agents'));
	listAgentCompanies(baselineParams('agent-companies'));
	listCompanies(baselineParams('companies'));
}
