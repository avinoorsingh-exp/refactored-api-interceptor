/**
 * Shared HTTP wrapper for all k6 tests.
 *
 * Centralizes: auth headers, tagging, URL building, error logging.
 * All module journeys should use this instead of k6/http directly.
 */
import http from 'k6/http';
import { config, getAuthHeaders } from './config.js';

const defaultHeaders = {
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

/**
 * Build a full URL from a path.
 * @param {string} path — e.g. '/v1/agents'
 * @returns {string}
 */
export function buildUrl(path) {
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${config.baseUrl}${p}`;
}

/**
 * Merge default + auth + custom headers.
 */
function mergeHeaders(custom = {}) {
	return Object.assign({}, defaultHeaders, getAuthHeaders(), custom);
}

/**
 * Build k6 params with standard tags.
 * @param {object} opts
 * @param {string} opts.module    — e.g. 'agents', 'companies'
 * @param {string} opts.endpoint  — e.g. '/v1/agents'
 * @param {string} opts.operation — e.g. 'list', 'getById', 'create'
 * @param {string} [opts.scenario] — e.g. 'smoke', 'baseline'
 * @param {string} [opts.method]   — HTTP method for tagging
 * @param {object} [opts.headers]  — extra headers
 * @param {object} [opts.tags]     — extra tags
 */
function buildParams(opts = {}) {
	const tags = {
		service: 'agent-service',
		module: opts.module || 'unknown',
		endpoint: opts.endpoint || '',
		operation: opts.operation || '',
		scenario: opts.scenario || __ENV.K6_SCENARIO || '',
		method: opts.method || 'GET',
		env: config.env,
	};
	if (opts.tags) Object.assign(tags, opts.tags);

	return {
		headers: mergeHeaders(opts.headers),
		tags,
	};
}

/**
 * GET request with standard tags and auth.
 */
export function get(path, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'GET', endpoint: path });
	return http.get(url, params);
}

/**
 * POST request with standard tags and auth.
 */
export function post(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'POST', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	return http.post(url, payload, params);
}

/**
 * PUT request with standard tags and auth.
 */
export function put(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'PUT', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	return http.put(url, payload, params);
}

/**
 * PATCH request with standard tags and auth.
 */
export function patch(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'PATCH', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	return http.patch(url, payload, params);
}

/**
 * DELETE request with standard tags and auth.
 */
export function del(path, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'DELETE', endpoint: path });
	return http.del(url, null, params);
}
