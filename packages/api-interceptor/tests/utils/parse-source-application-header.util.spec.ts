import {
	API_INTERCEPTOR_SOURCE_APP_HEADER,
	parseSourceApplicationHeader,
} from '../../src/utils/parse-source-application-header.util.js';

describe('parseSourceApplicationHeader', () => {
	it('returns undefined when header missing', () => {
		expect(parseSourceApplicationHeader(() => undefined)).toBeUndefined();
	});

	it('trims and returns value', () => {
		expect(
			parseSourceApplicationHeader((name) =>
				name === API_INTERCEPTOR_SOURCE_APP_HEADER ? '  IMS  ' : undefined,
			),
		).toBe('IMS');
	});

	it('returns undefined for blank after trim', () => {
		expect(parseSourceApplicationHeader(() => '   ')).toBeUndefined();
	});

	it('truncates long values', () => {
		const long = 'a'.repeat(100);
		const out = parseSourceApplicationHeader(() => long);
		expect(out?.length).toBe(64);
		expect(out).toBe('a'.repeat(64));
	});
});
