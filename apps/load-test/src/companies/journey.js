/**
 * Companies journey — reusable request sequences.
 */
import { check, sleep } from 'k6';
import { get } from '../lib/http.js';
import { toQueryString, toTags } from '../lib/params.js';

const MODULE = 'companies';

/**
 * List companies with optional parameterized query.
 * @param {import('../lib/params.js').RequestParams} [params]
 */
export function listCompanies(params) {
	const qs = params ? toQueryString(params) : '';
	const extraTags = params ? toTags(params) : {};
	const res = get(`/v1/companies${qs}`, { module: MODULE, operation: 'list', tags: extraTags });
	check(res, {
		'companies list 200': (r) => r.status === 200,
	});
	sleep(0.5);
	return res;
}
