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
} from '../domain/api-monitoring.types.js';

/**
 * TypeORM entity for api_request_log table.
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
@Index('idx_api_request_log_monitoring_user', ['monitoringUserId', 'timestamp'])
export class ApiRequestLogEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'text' })
	route!: string;

	@Column({ type: 'text' })
	method!: HttpMethod;

	@Column({ name: 'status_code', type: 'integer' })
	statusCode!: number;

	@Column({ name: 'latency_ms', type: 'integer' })
	latencyMs!: number;

	@Column({ name: 'request_size_bytes', type: 'integer', nullable: true })
	requestSizeBytes?: number;

	@Column({ name: 'response_size_bytes', type: 'integer', nullable: true })
	responseSizeBytes?: number;

	@Column({ name: 'ip_address', type: 'text', nullable: true })
	ipAddress?: string;

	@Column({ name: 'user_agent', type: 'text', nullable: true })
	userAgent?: string;

	@Column({ name: 'correlation_id', type: 'uuid' })
	correlationId!: string;

	@Column({ type: 'timestamp with time zone' })
	timestamp!: Date;

	@Column({ name: 'actor_id', type: 'uuid', nullable: true })
	actorId?: string;

	@Column({ name: 'actor_type', type: 'text', nullable: true })
	actorType?: ApiActorType;

	/** Logical FK to {@link ApiMonitoringUserEntity} when the caller is a resolved USER profile. */
	@Column({ name: 'monitoring_user_id', type: 'uuid', nullable: true })
	monitoringUserId?: string;

	@Column({ name: 'has_error', type: 'boolean', default: false })
	hasError!: boolean;

	@Column({
		name: 'error_classification',
		type: 'text',
		nullable: true,
	})
	errorClassification?: ApiErrorClassification;

	@Column({ name: 'error_message', type: 'text', nullable: true })
	errorMessage?: string;

	@Column({ name: 'stack_trace', type: 'text', nullable: true })
	stackTrace?: string;

	/** Optional snapshot of parsed JSON/object body when capture is enabled in module options. */
	@Column({ name: 'request_body_snapshot', type: 'text', nullable: true })
	requestBodySnapshot?: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;
}
