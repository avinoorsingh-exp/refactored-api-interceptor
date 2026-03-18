/**
 * Shared k6 thresholds, trend stats, and scenario profiles.
 *
 * Environment overrides (no code edits needed):
 *   K6_P95_MS    — p95 latency threshold in ms (default varies by scenario)
 *   K6_P99_MS    — p99 latency threshold in ms
 *   K6_ERR_RATE  — max error rate as decimal (default 0.01 = 1%)
 */

/** Trend stats included in every summary export. */
export const summaryTrendStats = ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'];

function envInt(name, fallback) {
	const v = __ENV[name];
	return v ? parseInt(v, 10) : fallback;
}

function envFloat(name, fallback) {
	const v = __ENV[name];
	return v ? parseFloat(v) : fallback;
}

/**
 * Smoke: quick validation, low VUs, strict latency.
 */
export const smokeProfile = {
	stages: [
		{ duration: '10s', target: 3 },
		{ duration: '30s', target: 3 },
		{ duration: '5s', target: 0 },
	],
	thresholds: {
		http_req_failed: [`rate<${envFloat('K6_ERR_RATE', 0.01)}`],
		http_req_duration: [`p(95)<${envInt('K6_P95_MS', 1000)}`],
	},
	summaryTrendStats,
};

/**
 * Baseline: steady-state, moderate VUs, tighter latency.
 */
export const baselineProfile = {
	stages: [
		{ duration: '30s', target: 10 },
		{ duration: '2m', target: 10 },
		{ duration: '10s', target: 0 },
	],
	thresholds: {
		http_req_failed: [`rate<${envFloat('K6_ERR_RATE', 0.01)}`],
		http_req_duration: [
			`p(95)<${envInt('K6_P95_MS', 500)}`,
			`p(99)<${envInt('K6_P99_MS', 1500)}`,
		],
	},
	summaryTrendStats,
};

/**
 * Stress: ramp to high VUs, gate on error rate, report latency.
 */
export const stressProfile = {
	stages: [
		{ duration: '30s', target: 10 },
		{ duration: '1m', target: 30 },
		{ duration: '2m', target: 50 },
		{ duration: '1m', target: 30 },
		{ duration: '30s', target: 0 },
	],
	thresholds: {
		http_req_failed: [`rate<${envFloat('K6_ERR_RATE', 0.05)}`],
		// Latency thresholds are advisory in stress — only error rate gates.
		http_req_duration: [`p(95)<${envInt('K6_P95_MS', 3000)}`],
	},
	summaryTrendStats,
};
