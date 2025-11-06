import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'
import type { Company, Name, InstantUTC, Email } from '@exprealty/shared-domain'

/**
 * TypeORM entity for Company table.
 * Database representation of the domain Company type.
 * @public
 */
@Entity({ name: 'company', schema: 'core' })
export class CompanyEntity implements Company {
	/**
	 * Primary key (bigint).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	/**
	 * Company name.
	 * @public
	 */
	@Column({ type: 'text' })
	name!: Name

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	email!: Email

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: InstantUTC

	/**
	 * Last update timestamp.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: InstantUTC
}
