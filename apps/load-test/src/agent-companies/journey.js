/**
 * Agent-Companies journey — reusable request sequences.
 */
import { check, sleep } from 'k6';
import { get } from '../lib/http.js';
import { toQueryString, toTags } from '../lib/params.js';

const MODULE = 'agent-companies';

/**
 * List agent companies with optional parameterized query.
 * @param {import('../lib/params.js').RequestParams} [params]
 */
export function listAgentCompanies(params) {
	const qs = params ? toQueryString(params) : '';
	const extraTags = params ? toTags(params) : {};
	const res = get(`/v1/agent-companies${qs}`, { module: MODULE, operation: 'list', tags: extraTags });
	check(res, {
		'agent-companies list 200': (r) => r.status === 200,
	});
	sleep(0.5);
	return res;
}
