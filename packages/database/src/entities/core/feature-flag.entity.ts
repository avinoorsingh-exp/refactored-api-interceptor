import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Allowed feature flag keys. Only these two flags exist.
 */
export const FEATURE_FLAG_KEYS = ['PHASE_2', 'PHASE_3'] as const;
export type FeatureFlagKeyEntity = (typeof FEATURE_FLAG_KEYS)[number];

/**
 * TypeORM entity for feature_flags table.
 * Stores boolean flags (PHASE_2, PHASE_3) editable from Admin UI.
 *
 * @public
 */
@Entity({ name: 'feature_flags', schema: 'core' })
export class FeatureFlagEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'text', unique: true })
	key!: FeatureFlagKeyEntity;

	@Column({ type: 'boolean', default: false })
	enabled!: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date;
}
