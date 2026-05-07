/**
 * Verifies the package entry re-exports what consumers need to wire interception.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from '@jest/globals';
import * as Esm from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('public package surface (index)', () => {
	it('uses package version 0.0.1 in manifest', () => {
		const pkg = JSON.parse(
			readFileSync(join(__dirname, '../../package.json'), 'utf8'),
		) as { version: string };
		expect(pkg.version).toBe('0.0.1');
	});

	it('exports the module, interceptor, context, and exchange types', () => {
		expect(Esm.ApiInterceptorModule).toBeDefined();
		expect(Esm.ApiInterceptorModule.forRoot).toBeInstanceOf(Function);
		expect(Esm.ApiInterceptor).toBeDefined();
		expect(Esm.ApiRequestContextService).toBeDefined();
		expect(Esm.API_INTERCEPTOR_ASYNC_CONTEXT).toBeDefined();
		expect(Esm.API_INTERCEPTOR_ON_EXCHANGE).toBeDefined();
		expect(Esm.API_INTERCEPTOR_SOURCE_APP_HEADER).toBe('x-source-app');
		expect(Esm.parseSourceApplicationHeader).toBeInstanceOf(Function);
		expect(Esm.API_INTERCEPTOR_RETRY_COUNT_HEADER).toBe('x-retry-count');
		expect(Esm.parseRetryCountHeader).toBeInstanceOf(Function);
		expect(Esm.HttpMethod).toBeDefined();
		expect(Esm.ApiActorType).toBeDefined();
		expect(Esm.ApiErrorClassification).toBeDefined();
	});
});
