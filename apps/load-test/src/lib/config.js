/**
 * Shared configuration for all k6 scenarios.
 *
 * Environment variables (pass via k6 --env or shell export):
 *   BASE_URL      (required) — target service URL
 *   ENV           (optional) — local|dev|stage, for labeling
 *   AUTH_MODE     (optional) — none|bearer|apikey (default: none)
 *   AUTH_TOKEN    (optional) — bearer token when AUTH_MODE=bearer
 *   API_KEY       (optional) — API key when AUTH_MODE=apikey
 *   RUN_ID        (optional) — override auto-generated run ID
 */

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
	throw new Error(
		'BASE_URL is required. Pass via: k6 run --env BASE_URL=http://localhost:3000 ...',
	);
}

export const config = {
	baseUrl: BASE_URL.replace(/\/+$/, ''), // strip trailing slash
	env: __ENV.ENV || 'local',
	authMode: __ENV.AUTH_MODE || 'none',
	authToken: __ENV.AUTH_TOKEN || '',
	apiKey: __ENV.API_KEY || '',
	runId: __ENV.RUN_ID || '',
};

/**
 * Returns auth headers based on AUTH_MODE.
 */
export function getAuthHeaders() {
	switch (config.authMode) {
		case 'bearer':
			if (!config.authToken) {
				throw new Error('AUTH_MODE=bearer requires AUTH_TOKEN to be set');
			}
			return { Authorization: `Bearer ${config.authToken}` };
		case 'apikey':
			if (!config.apiKey) {
				throw new Error('AUTH_MODE=apikey requires API_KEY to be set');
			}
			return { 'x-api-key': config.apiKey };
		case 'none':
		default:
			return {};
	}
}

/**
 * Returns BASE_URL safe for logging (no secrets in query params).
 */
export function sanitizeBaseUrl() {
	try {
		const u = new URL(config.baseUrl);
		return `${u.protocol}//${u.host}${u.pathname}`;
	} catch {
		return config.baseUrl;
	}
}
