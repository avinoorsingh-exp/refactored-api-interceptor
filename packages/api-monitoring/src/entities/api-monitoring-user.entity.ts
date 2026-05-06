import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';

/**
 * TypeORM entity for `api_monitoring_user` — one row per logical end-user (human) when
 * `ApiActorType.USER` is resolved, holding email and external id for reporting.
 *
 * `actor_id` is the related {@link ApiActorEntity} row for that user. `api_request_log.monitoring_user_id`
 * points here for each HTTP request (when a user profile exists).
 *
 * @public
 */
@Entity({ name: 'api_monitoring_user', schema: 'core' })
@Index('idx_api_monitoring_user_actor', ['actorId'])
@Index('uq_api_monitoring_user_external_id', ['externalId'], { unique: true })
export class ApiMonitoringUserEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** Logical link to `core.api_actor.id` (typically `ApiActorType.USER`). */
	@Column({ name: 'actor_id', type: 'uuid' })
	actorId!: string;

	/**
	 * Stable unique id from the IdP (Cognito `sub`, internal id, never-changing username, etc.).
	 * Use this for joins when the value is not a UUID string.
	 */
	@Column({ name: 'external_id', type: 'text' })
	externalId!: string;

	/**
	 * When `external_id` is a UUID string, the same value stored as `uuid` for typed queries;
	 * otherwise null.
	 */
	@Column({ name: 'user_uuid', type: 'uuid', nullable: true })
	userUuid?: string;

	@Column({ name: 'email', type: 'text', nullable: true })
	email?: string;

	/**
	 * Last non-empty `x-source-app` seen for this profile on upsert (informational; per-request app is on `api_request_log`).
	 */
	@Column({ name: 'last_source_application', type: 'text', nullable: true })
	lastSourceApplication?: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}
