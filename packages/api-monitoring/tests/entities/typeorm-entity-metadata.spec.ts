import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { ApiActorEntity } from '../../src/entities/api-actor.entity.js';
import { ApiMonitoringUserEntity } from '../../src/entities/api-monitoring-user.entity.js';
import { ApiRequestLogEntity } from '../../src/entities/api-request-log.entity.js';
import { ApiRouteStatsEntity } from '../../src/entities/api-route-stats.entity.js';
import { HttpMethod, TimeBucket } from '../../src/domain/api-monitoring.types.js';

type TableEntry = { target: unknown; name?: string; schema?: string | undefined };

function getTables(): TableEntry[] {
	return (getMetadataArgsStorage() as { tables: TableEntry[] }).tables;
}

function tableFor(target: unknown) {
	return getTables().find((t) => t.target === target);
}

describe('API monitoring TypeORM entities (core schema)', () => {
	it('registers four table metadata entries for the monitoring entities', () => {
		const t = [ApiActorEntity, ApiRequestLogEntity, ApiRouteStatsEntity, ApiMonitoringUserEntity].map((C) =>
			tableFor(C),
		);
		expect(t.filter(Boolean).length).toBe(4);
	});

	it('api_actor: table core.api_actor and identity index on type + identifier', () => {
		const row = tableFor(ApiActorEntity);
		expect(row?.name).toBe('api_actor');
		expect(row?.schema).toBe('core');
		const storage = getMetadataArgsStorage() as {
			indices: { target: unknown; name: string; unique: boolean; columns: string[] }[];
		};
		const actorIndex = storage.indices.find(
			(i) => i.target === ApiActorEntity && i.name === 'idx_api_actor_type_identifier',
		);
		expect(actorIndex?.unique).toBe(true);
		expect(actorIndex?.columns).toEqual(['type', 'identifier']);
	});

	it('api_request_log: table core.api_request_log', () => {
		const row = tableFor(ApiRequestLogEntity);
		expect(row?.name).toBe('api_request_log');
		expect(row?.schema).toBe('core');
		const ts = (getMetadataArgsStorage() as { indices: { target: unknown; name: string }[] }).indices
			.filter((i) => i.target === ApiRequestLogEntity)
			.map((i) => i.name);
		expect(ts).toEqual(
			expect.arrayContaining([
				'idx_api_request_log_timestamp',
				'idx_api_request_log_correlation',
				'idx_api_request_log_error',
				'idx_api_request_log_monitoring_user',
			]),
		);
	});

	it('api_monitoring_user: table core.api_monitoring_user', () => {
		const row = tableFor(ApiMonitoringUserEntity);
		expect(row?.name).toBe('api_monitoring_user');
		expect(row?.schema).toBe('core');
	});

	it('api_request_log: request_body_snapshot column mapped for optional body capture', () => {
		const storage = getMetadataArgsStorage() as {
			filterColumns: (t: unknown) => { propertyName: string; options: { name?: string; type?: string } }[];
		};
		const cols = storage.filterColumns(ApiRequestLogEntity);
		const snap = cols.find((c) => c.propertyName === 'requestBodySnapshot');
		expect(snap?.options.name).toBe('request_body_snapshot');
		expect(snap?.options.type).toBe('text');
	});

	it('api_route_stats: composite unique constraint on route, method, time bucket, bucket start', () => {
		const row = tableFor(ApiRouteStatsEntity);
		expect(row?.name).toBe('api_route_stats');
		expect(row?.schema).toBe('core');
		const storage = getMetadataArgsStorage() as {
			uniques: { target: unknown; name: string; columns: string[] }[];
		};
		const u = storage.uniques.find(
			(x) => x.target === ApiRouteStatsEntity && x.name === 'uq_api_route_stats_route_method_bucket',
		);
		expect(u?.columns).toEqual(['route', 'method', 'timeBucket', 'bucketStart']);
	});

	it('keeps domain enums as string values compatible with text columns', () => {
		expect(HttpMethod.GET).toBe('GET');
		expect(TimeBucket.MINUTE).toBe('minute');
		expect(TimeBucket.DAY).toBe('day');
	});
});
