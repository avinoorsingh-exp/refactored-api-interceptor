import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';
import { ApiActorType } from '../domain/api-monitoring.types.js';

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
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'text' })
	type!: ApiActorType;

	@Column({ type: 'text', nullable: true })
	identifier?: string;

	@Column({ name: 'display_name', type: 'text' })
	displayName!: string;

	@Column({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	@Column({ type: 'boolean', default: true })
	active!: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}
