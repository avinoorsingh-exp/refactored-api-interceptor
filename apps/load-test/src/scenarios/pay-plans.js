import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
	stages: [
		{ duration: '30s', target: 10 },
		{ duration: '1m', target: 10 },
		{ duration: '10s', target: 0 },
	],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
	const res = http.get(`${BASE_URL}/v1/pay-plans`);
	check(res, {
		'status is 200': (r) => r.status === 200,
	});
	sleep(1);
}
