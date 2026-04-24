import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
	Unique,
} from 'typeorm';
import { HttpMethod, TimeBucket } from '../domain/api-monitoring.types.js';

/**
 * TypeORM entity for api_route_stats table.
 *
 * @public
 */
@Entity({ name: 'api_route_stats', schema: 'core' })
@Unique('uq_api_route_stats_route_method_bucket', [
	'route',
	'method',
	'timeBucket',
	'bucketStart',
])
@Index('idx_api_route_stats_bucket_start', ['bucketStart'])
@Index('idx_api_route_stats_route_method', ['route', 'method'])
export class ApiRouteStatsEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'text' })
	route!: string;

	@Column({ type: 'text' })
	method!: HttpMethod;

	@Column({ name: 'time_bucket', type: 'text' })
	timeBucket!: TimeBucket;

	@Column({ name: 'bucket_start', type: 'timestamp with time zone' })
	bucketStart!: Date;

	@Column({ name: 'request_count', type: 'integer', default: 0 })
	requestCount!: number;

	@Column({ name: 'error_count', type: 'integer', default: 0 })
	errorCount!: number;

	@Column({ name: 'latency_p50', type: 'integer', nullable: true })
	latencyP50?: number;

	@Column({ name: 'latency_p95', type: 'integer', nullable: true })
	latencyP95?: number;

	@Column({ name: 'latency_p99', type: 'integer', nullable: true })
	latencyP99?: number;

	@Column({ name: 'latency_min', type: 'integer', nullable: true })
	latencyMin?: number;

	@Column({ name: 'latency_max', type: 'integer', nullable: true })
	latencyMax?: number;

	@Column({
		name: 'status_code_counts',
		type: 'jsonb',
		nullable: true,
	})
	statusCodeCounts?: Record<string, number>;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}
