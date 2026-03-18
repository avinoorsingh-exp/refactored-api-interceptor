/**
 * Agents-only smoke scenario — quick validation that agents endpoints are alive.
 *
 * Deterministic params: default page size, no search, includes=none.
 * Override via env vars: PAGE_SIZE, INCLUDES, FILTERS, AGENTS_*
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 pnpm loadtest:agents:smoke
 *
 * Endpoints hit:
 *   GET /v1/agent/health
 *   GET /v1/agents
 */
import { smokeProfile } from '../lib/k6-constants.js';
import { smokeParams } from '../lib/params.js';
import { healthCheck, listAgents } from '../agents/journey.js';

export const options = {
	scenarios: {
		'agents-smoke': {
			executor: 'ramping-vus',
			stages: smokeProfile.stages,
			tags: { scenario: 'agents-smoke' },
		},
	},
	thresholds: smokeProfile.thresholds,
	summaryTrendStats: smokeProfile.summaryTrendStats,
};

export default function () {
	healthCheck();
	listAgents(smokeParams('agents'));
}
