import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
} from 'typeorm'
import type { Company, Name, Email } from '@exprealty/shared-domain'
import { AuditableEntity } from './auditable.entity.js'

/**
 * TypeORM entity for Company table.
 * Database representation of the domain Company type.
 * @public
 */
@Entity({ name: 'company', schema: 'core' })
export class CompanyEntity extends AuditableEntity implements Company {
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
}
