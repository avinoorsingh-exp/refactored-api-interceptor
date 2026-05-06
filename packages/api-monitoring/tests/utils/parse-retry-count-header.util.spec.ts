import {
	API_MONITORING_RETRY_COUNT_HEADER,
	parseRetryCountHeader,
} from '../../src/utils/parse-retry-count-header.util.js';

describe('parseRetryCountHeader', () => {
	it('returns 0 when header missing', () => {
		expect(parseRetryCountHeader(() => undefined)).toBe(0);
	});

	it('parses integer string', () => {
		expect(
			parseRetryCountHeader((name) =>
				name === API_MONITORING_RETRY_COUNT_HEADER ? '2' : undefined,
			),
		).toBe(2);
	});

	it('trims whitespace', () => {
		expect(parseRetryCountHeader(() => '  1  ')).toBe(1);
	});

	it('returns 0 for invalid or negative', () => {
		expect(parseRetryCountHeader(() => 'abc')).toBe(0);
		expect(parseRetryCountHeader(() => '-1')).toBe(0);
	});

	it('truncates at max', () => {
		expect(parseRetryCountHeader(() => '999999')).toBe(10_000);
	});
});
