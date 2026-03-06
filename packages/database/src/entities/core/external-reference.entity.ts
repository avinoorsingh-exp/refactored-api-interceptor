import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	OneToMany,
} from 'typeorm'
import { FullAuditableEntity } from './full-auditable.entity.js'

/**
 * TypeORM entity for ExternalReference table.
 * Stores references to external systems (e.g., legacy IDs, Salesforce, Mendix).
 * @public
 */
@Entity({ name: 'external_reference', schema: 'core' })
export class ExternalReferenceEntity extends FullAuditableEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'system_code', type: 'text' })
	systemCode!: string

	@Column({ name: 'ref_key', type: 'text' })
	refKey!: string

	@Column({ name: 'ref_value', type: 'text' })
	refValue!: string

	@OneToMany('AgentExternalReferenceEntity', 'externalReference')
	agents?: unknown[]

	@OneToMany('OfficeExternalReferenceEntity', 'externalReference')
	offices?: unknown[]

	@OneToMany('CompanyExternalReferenceEntity', 'externalReference')
	companies?: unknown[]
}
