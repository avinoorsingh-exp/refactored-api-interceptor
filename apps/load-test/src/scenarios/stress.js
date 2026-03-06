/**
 * Stress scenario — ramp to high VUs. Gates on error rate; latency is advisory.
 *
 * Defaults to worst-case: contains search + heavy includes + largest page size.
 * Configurable via env vars for targeted stress testing.
 *
 * Override via env vars: PAGE_SIZE_SET, SEARCH_MODE, SEARCH_TERMS,
 *   INCLUDES, FILTERS
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 k6 run src/scenarios/stress.js
 *
 * Worst-case rerun example:
 *   BASE_URL=http://localhost:3000 SEARCH_MODE=contains INCLUDES=heavy \
 *     PAGE_SIZE_SET=100 k6 run src/scenarios/stress.js
 */
import { stressProfile } from '../lib/k6-constants.js';
import { stressParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';
import { listAgentCompanies } from '../agent-companies/journey.js';
import { listCompanies } from '../companies/journey.js';

export const options = {
	scenarios: {
		stress: {
			executor: 'ramping-vus',
			stages: stressProfile.stages,
		},
	},
	thresholds: stressProfile.thresholds,
	summaryTrendStats: stressProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(stressParams('agents'));
	listAgentCompanies(stressParams('agent-companies'));
	listCompanies(stressParams('companies'));
}
