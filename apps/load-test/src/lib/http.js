/**
 * Shared HTTP wrapper for all k6 tests.
 *
 * Centralizes: auth headers, tagging, URL building, error logging.
 * Records hotspot Trend metrics for curated endpoints.
 * All module journeys should use this instead of k6/http directly.
 */
import http from 'k6/http';
import { config, getAuthHeaders } from './config.js';
import { recordHotspot } from './metrics.js';

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
 * Record hotspot trend metric after a request completes.
 */
function recordTrend(method, path, res, tags) {
	if (res && res.timings) {
		recordHotspot(method, path.split('?')[0], res.timings.duration, tags);
	}
}

/**
 * GET request with standard tags and auth.
 */
export function get(path, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'GET', endpoint: path });
	const res = http.get(url, params);
	recordTrend('GET', path, res, params.tags);
	return res;
}

/**
 * POST request with standard tags and auth.
 */
export function post(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'POST', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	const res = http.post(url, payload, params);
	recordTrend('POST', path, res, params.tags);
	return res;
}

/**
 * PUT request with standard tags and auth.
 */
export function put(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'PUT', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	const res = http.put(url, payload, params);
	recordTrend('PUT', path, res, params.tags);
	return res;
}

/**
 * PATCH request with standard tags and auth.
 */
export function patch(path, body, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'PATCH', endpoint: path });
	const payload = typeof body === 'string' ? body : JSON.stringify(body);
	const res = http.patch(url, payload, params);
	recordTrend('PATCH', path, res, params.tags);
	return res;
}

/**
 * DELETE request with standard tags and auth.
 */
export function del(path, opts = {}) {
	const url = buildUrl(path);
	const params = buildParams({ ...opts, method: 'DELETE', endpoint: path });
	const res = http.del(url, null, params);
	recordTrend('DELETE', path, res, params.tags);
	return res;
}
