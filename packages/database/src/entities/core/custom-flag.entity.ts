import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for CustomFlag table.
 * @public
 */
@Entity({ name: 'custom_flag', schema: 'core' })
export class CustomFlagEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	flagId!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text' })
	type!: string

	@Column({ type: 'text' })
	scope!: string

	@Column({ type: 'boolean' })
	active!: boolean

	@Column({ name: 'delete_in_progress', type: 'boolean', default: false })
	deleteInProgress?: boolean
}
