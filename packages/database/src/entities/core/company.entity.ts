import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	OneToMany,
} from 'typeorm'
import type { Company, Name, Email } from '@exprealty/shared-domain'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

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
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique company identifier', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Company name.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Company/brokerage name' })
	@Filterable()
	@Sortable()
	name!: Name

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 7, behavior: 'partial', description: 'Company email address' })
	@Filterable()
	@Sortable()
	email?: Email

	@OneToMany('CompanyExternalReferenceEntity', 'company')
	companyExternalReferences?: unknown[]
}
