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
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js'
import type { StateProgramEntity } from './state-program.entity.js'

/**
 * TypeORM entity for State table.
 * @public
 */
@Entity({ name: 'state', schema: 'core' })
export class StateEntity extends AuditableEntity {
	@PrimaryGeneratedColumn('uuid')
	@Filterable()
	id!: string

	@Column({ type: 'text' })
	@Searchable()
	@Filterable()
	@Sortable()
	name!: string

	@Column({ type: 'text' })
	@Searchable()
	@Filterable()
	@Sortable()
	code!: string

	@Column({ name: 'is_active', type: 'boolean' })
	@Filterable()
	@Sortable()
	isActive!: boolean

	@Column({ type: 'text', nullable: true })
	@Searchable()
	@Filterable()
	email?: string

	@Column({
		name: 'signature_distribution_email',
		type: 'text',
		nullable: true,
	})
	@Filterable()
	signatureDistributionEmail?: string

	@Column({ name: 'region_id', type: 'bigint' })
	@Filterable()
	regionId!: bigint

	@ManyToOne(() => RegionEntity, (region) => region.id, { cascade: true, eager: false })
	@JoinColumn({ name: 'region_id' })
	region?: RegionEntity

	@Column({ name: 'country_id', type: 'integer' })
	@Filterable()
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
