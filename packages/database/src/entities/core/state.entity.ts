import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToOne,
	JoinColumn,
	OneToMany,
} from 'typeorm'
import { RegionEntity } from './region.entity.js'
import { CountryEntity } from './country.entity.js'
import { SearchableAuditableEntity } from './searchable-auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'
import type { StateProgramEntity } from './state-program.entity.js'

/**
 * TypeORM entity for State table.
 * Extends SearchableAuditableEntity to include lastModified and modifiedBy in search.
 * @public
 */
@Entity({ name: 'state', schema: 'core' })
export class StateEntity extends SearchableAuditableEntity {
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	@Sortable()
	id!: string

	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'State/province display name' })
	@Filterable()
	@Sortable()
	name!: string

	@Column({ type: 'varchar', length: 2, unique: true })
	@Searchable({ weight: 8, behavior: 'exact', description: 'Two-letter state code (e.g., CA, TX)' })
	@Filterable()
	@Sortable()
	code!: string

	@Column({ name: 'is_active', type: 'boolean' })
	@Searchable({ type: 'boolean', weight: 3, behavior: 'exact', description: 'Whether the state is active' })
	@Filterable()
	@Sortable()
	isActive!: boolean

	@Column({ type: 'text', nullable: true })
	@Searchable({ weight: 5, behavior: 'partial', description: 'State contact email' })
	@Filterable()
	@Sortable()
	email?: string

	@Column({
		name: 'signature_distribution_email',
		type: 'text',
		nullable: true,
	})
	@Searchable({ weight: 5, behavior: 'partial', description: 'Signature distribution email' })
	@Filterable()
	@Sortable()
	signatureDistributionEmail?: string

	@Column({ name: 'region_id', type: 'bigint' })
	@Searchable({ type: 'integer', weight: 4, behavior: 'exact', description: 'Associated region ID', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	regionId!: bigint

	@ManyToOne(() => RegionEntity, (region) => region.id, { cascade: true, eager: false })
	@JoinColumn({ name: 'region_id' })
	region?: RegionEntity

	@Column({ name: 'country_id', type: 'integer' })
	@Filterable()
	@Sortable()
	countryId!: number

	@ManyToOne(() => CountryEntity, { eager: false })
	@JoinColumn({ name: 'country_id' })
	country?: CountryEntity

	/**
	 * One-to-many relationship with StateProgram.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('StateProgramEntity', 'state')
	statePrograms?: StateProgramEntity[]
}
