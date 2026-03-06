/**
 * Smoke scenario — quick validation that key endpoints are alive.
 *
 * Uses fixed, deterministic params: default page size, no search, includes=none.
 * Override via env vars: PAGE_SIZE, INCLUDES, FILTERS
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 k6 run src/scenarios/smoke.js
 *
 * Endpoints hit:
 *   GET /v1/agent/health
 *   GET /v1/agents
 *   GET /v1/agent-companies
 *   GET /v1/companies
 */
import { smokeProfile } from '../lib/k6-constants.js';
import { smokeParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';
import { listAgentCompanies } from '../agent-companies/journey.js';
import { listCompanies } from '../companies/journey.js';

export const options = {
	scenarios: {
		smoke: {
			executor: 'ramping-vus',
			stages: smokeProfile.stages,
		},
	},
	thresholds: smokeProfile.thresholds,
	summaryTrendStats: smokeProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(smokeParams('agents'));
	listAgentCompanies(smokeParams('agent-companies'));
	listCompanies(smokeParams('companies'));
}
