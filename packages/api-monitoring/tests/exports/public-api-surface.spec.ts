/**
 * Verifies the package entry re-exports everything consumers need to wire monitoring
 * and connect their own TypeORM data source.
 * (Isolated `package.json` dependency rules are in `package-isolation-and-dist.spec.ts`.)
 */
import * as Esm from '../../src/index.js';

describe('public package surface (index)', () => {
	it('exports the dynamic module, default entities, and key runtime symbols', () => {
		expect(Esm.ApiMonitoringModule).toBeDefined();
		expect(Esm.ApiMonitoringModule.forRoot).toBeInstanceOf(Function);
		expect(Esm.DEFAULT_API_MONITORING_ENTITIES).toBeDefined();
		expect(Esm.API_MONITORING_TYPEORM_ENTITIES).toBeDefined();
		expect(Esm.ApiRequestLogEntity).toBeDefined();
		expect(Esm.ApiRouteStatsEntity).toBeDefined();
		expect(Esm.ApiActorEntity).toBeDefined();
		expect(Esm.ApiMonitoringService).toBeDefined();
		expect(Esm.ApiMetricsService).toBeDefined();
		expect(Esm.ApiMonitoringController).toBeDefined();
		expect(Esm.ApiMonitoringInterceptor).toBeDefined();
		expect(Esm.ApiActorMiddleware).toBeDefined();
		expect(Esm.API_MONITORING_LOGGER_TOKEN).toBeDefined();
		expect(Esm.API_MONITORING_ASYNC_CONTEXT).toBeDefined();
		expect(Esm.API_MONITORING_ENTITY_CLASSES).toBeDefined();
	});
});
