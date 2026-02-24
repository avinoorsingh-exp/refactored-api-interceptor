/**
 * Agents journey — reusable request sequences.
 */
import { check, sleep } from 'k6';
import { get } from '../lib/http.js';
import { toQueryString, toTags } from '../lib/params.js';

const MODULE = 'agents';

/**
 * List agents with optional parameterized query.
 * @param {import('../lib/params.js').RequestParams} [params] — paging, search, filters, includes
 */
export function listAgents(params) {
	const qs = params ? toQueryString(params) : '';
	const extraTags = params ? toTags(params) : {};
	const res = get(`/v1/agents${qs}`, { module: MODULE, operation: 'list', tags: extraTags });
	check(res, {
		'agents list 200': (r) => r.status === 200,
	});
	sleep(0.5);
	return res;
}

/** Health check — no parameterization needed. */
export function healthCheck() {
	const res = get('/v1/agent/health', { module: MODULE, operation: 'health' });
	check(res, {
		'health 200': (r) => r.status === 200,
	});
	sleep(0.3);
	return res;
}
