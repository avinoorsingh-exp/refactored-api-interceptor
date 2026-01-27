import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	Index,
} from 'typeorm';
import {
	HttpMethod,
	ApiErrorClassification,
	ApiActorType,
} from '@exprealty/shared-domain';

/**
 * TypeORM entity for api_request_log table.
 * 
 * High-volume, append-only log of all API requests.
 * Optimized for time-range queries and aggregation.
 * 
 * Retention policy: Hot data (recent) kept in main table,
 * cold data can be archived to separate tables/partitions.
 * 
 * @public
 */
@Entity({ name: 'api_request_log', schema: 'core' })
@Index('idx_api_request_log_timestamp', ['timestamp'])
@Index('idx_api_request_log_route_method', ['route', 'method'])
@Index('idx_api_request_log_actor', ['actorId', 'timestamp'])
@Index('idx_api_request_log_correlation', ['correlationId'])
@Index('idx_api_request_log_status', ['statusCode', 'timestamp'])
@Index('idx_api_request_log_error', ['hasError', 'timestamp'])
export class ApiRequestLogEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * API route path (e.g., '/v1/agents').
	 * @public
	 */
	@Column({ type: 'text' })
	route!: string;

	/**
	 * HTTP method (GET, POST, etc.).
	 * @public
	 */
	@Column({ type: 'text' })
	method!: HttpMethod;

	/**
	 * HTTP status code.
	 * @public
	 */
	@Column({ name: 'status_code', type: 'integer' })
	statusCode!: number;

	/**
	 * Request latency in milliseconds.
	 * @public
	 */
	@Column({ name: 'latency_ms', type: 'integer' })
	latencyMs!: number;

	/**
	 * Request body size in bytes (if available).
	 * @public
	 */
	@Column({ name: 'request_size_bytes', type: 'integer', nullable: true })
	requestSizeBytes?: number;

	/**
	 * Response body size in bytes (if available).
	 * @public
	 */
	@Column({ name: 'response_size_bytes', type: 'integer', nullable: true })
	responseSizeBytes?: number;

	/**
	 * Client IP address.
	 * @public
	 */
	@Column({ name: 'ip_address', type: 'text', nullable: true })
	ipAddress?: string;

	/**
	 * User agent string.
	 * @public
	 */
	@Column({ name: 'user_agent', type: 'text', nullable: true })
	userAgent?: string;

	/**
	 * Correlation/request ID for tracing.
	 * @public
	 */
	@Column({ name: 'correlation_id', type: 'uuid' })
	correlationId!: string;

	/**
	 * Request timestamp (when request started).
	 * @public
	 */
	@Column({ type: 'timestamp with time zone' })
	timestamp!: Date;

	/**
	 * Actor ID (foreign key to api_actor).
	 * @public
	 */
	@Column({ name: 'actor_id', type: 'uuid', nullable: true })
	actorId?: string;

	/**
	 * Actor type (denormalized for query performance).
	 * @public
	 */
	@Column({ name: 'actor_type', type: 'text', nullable: true })
	actorType?: ApiActorType;

	/**
	 * Whether this request resulted in an error.
	 * @public
	 */
	@Column({ name: 'has_error', type: 'boolean', default: false })
	hasError!: boolean;

	/**
	 * Error classification (if hasError is true).
	 * @public
	 */
	@Column({
		name: 'error_classification',
		type: 'text',
		nullable: true,
	})
	errorClassification?: ApiErrorClassification;

	/**
	 * Error message (sanitized, no PII).
	 * @public
	 */
	@Column({ name: 'error_message', type: 'text', nullable: true })
	errorMessage?: string;

	/**
	 * Stack trace (only for server errors, 5xx).
	 * @public
	 */
	@Column({ name: 'stack_trace', type: 'text', nullable: true })
	stackTrace?: string;

	/**
	 * Creation timestamp (when log was written).
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;
}

