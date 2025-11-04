import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'

/**
 * TypeORM entity for LineOfBusiness table.
 * @public
 */
@Entity({ name: 'line_of_business', schema: 'core' })
export class LineOfBusinessEntity {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	/**
	 * One-to-many relationship with License.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('LicenseEntity', 'lineOfBusiness')
	licenses?: unknown[]
}
