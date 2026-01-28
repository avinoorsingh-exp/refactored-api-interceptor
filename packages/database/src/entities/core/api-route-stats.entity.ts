import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
	Unique,
} from 'typeorm';
import { HttpMethod, TimeBucket } from '@exprealty/shared-domain';

/**
 * TypeORM entity for api_route_stats table.
 * 
 * Pre-aggregated statistics by route, method, and time bucket.
 * Used for fast dashboard queries without scanning raw logs.
 * 
 * Aggregation is performed by background workers to avoid blocking requests.
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
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * API route path.
	 * @public
	 */
	@Column({ type: 'text' })
	route!: string;

	/**
	 * HTTP method.
	 * @public
	 */
	@Column({ type: 'text' })
	method!: HttpMethod;

	/**
	 * Time bucket (minute, hour, day).
	 * @public
	 */
	@Column({ name: 'time_bucket', type: 'text' })
	timeBucket!: TimeBucket;

	/**
	 * Start of the time bucket.
	 * @public
	 */
	@Column({ name: 'bucket_start', type: 'timestamp with time zone' })
	bucketStart!: Date;

	/**
	 * Total request count in this bucket.
	 * @public
	 */
	@Column({ name: 'request_count', type: 'integer', default: 0 })
	requestCount!: number;

	/**
	 * Total error count in this bucket.
	 * @public
	 */
	@Column({ name: 'error_count', type: 'integer', default: 0 })
	errorCount!: number;

	/**
	 * 50th percentile latency (median) in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_p50', type: 'integer', nullable: true })
	latencyP50?: number;

	/**
	 * 95th percentile latency in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_p95', type: 'integer', nullable: true })
	latencyP95?: number;

	/**
	 * 99th percentile latency in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_p99', type: 'integer', nullable: true })
	latencyP99?: number;

	/**
	 * Minimum latency in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_min', type: 'integer', nullable: true })
	latencyMin?: number;

	/**
	 * Maximum latency in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_max', type: 'integer', nullable: true })
	latencyMax?: number;

	/**
	 * Status code counts as JSON (e.g., {"200": 100, "404": 5}).
	 * @public
	 */
	@Column({
		name: 'status_code_counts',
		type: 'jsonb',
		nullable: true,
	})
	statusCodeCounts?: Record<string, number>;

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Last update timestamp (updated during aggregation).
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}


