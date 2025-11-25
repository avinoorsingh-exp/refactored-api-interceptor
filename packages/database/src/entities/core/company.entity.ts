import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
} from 'typeorm'
import type { Company, Name, Email } from '@exprealty/shared-domain'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'

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
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Company name.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable()
	@Filterable()
	@Sortable()
	name!: Name

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable()
	@Filterable()
	@Sortable()
	email!: Email
}
