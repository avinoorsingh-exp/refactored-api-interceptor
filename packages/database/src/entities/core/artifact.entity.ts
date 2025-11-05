import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'

/**
 * TypeORM entity for Artifact table.
 * @public
 */
@Entity({ name: 'artifact', schema: 'core' })
export class ArtifactEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	type!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	url?: string

	@Column({ name: 'storage_key', type: 'text', nullable: true })
	storageKey?: string

	@Column({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date
}
