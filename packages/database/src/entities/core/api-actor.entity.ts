import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';
import { ApiActorType } from '@exprealty/shared-domain';

/**
 * TypeORM entity for api_actor table.
 * 
 * Tracks external actors (users, API keys, service accounts) that make API requests.
 * Used for attribution, rate limiting, and security monitoring.
 * 
 * @public
 */
@Entity({ name: 'api_actor', schema: 'core' })
@Index('idx_api_actor_type_identifier', ['type', 'identifier'], { unique: true })
@Index('idx_api_actor_created_at', ['createdAt'])
export class ApiActorEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * Actor type (user, api_key, service_account, etc.).
	 * @public
	 */
	@Column({ type: 'text' })
	type!: ApiActorType;

	/**
	 * Human-readable identifier (email, API key name, service name).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	identifier?: string;

	/**
	 * Additional metadata as JSON.
	 * @public
	 */
	@Column({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/**
	 * Whether this actor is active.
	 * @public
	 */
	@Column({ type: 'boolean', default: true })
	active!: boolean;

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	/**
	 * Last update timestamp.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}

