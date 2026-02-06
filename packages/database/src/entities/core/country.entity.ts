import { Country } from '@exprealty/shared-domain'
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Sortable, Filterable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for Country table.
 * Stores ISO 3166-1 country reference data.
 * @public
 */
@Entity({ name: 'country', schema: 'core' })
export class CountryEntity extends AuditableEntity implements Country {
	/**
	 * Primary key with auto-increment integer.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'integer', name: 'id' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique country identifier', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	id!: number

	/**
	 * Country name (e.g., "United States of America", "Canada").
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Country display name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * ISO 3166-1 alpha-2 code (e.g., "US", "CA").
	 * @public
	 */
	@Column({ name: 'alpha_2', type: 'varchar', length: 2, unique: true })
	@Searchable({ weight: 8, behavior: 'exact', description: 'ISO 3166-1 alpha-2 code (e.g., US, CA)' })
	@Filterable()
	@Sortable()
	alpha2!: string

	/**
	 * ISO 3166-1 alpha-3 code (e.g., "USA", "CAN").
	 * @public
	 */
	@Column({ name: 'alpha_3', type: 'varchar', length: 3, unique: true })
	@Searchable({ weight: 8, behavior: 'exact', description: 'ISO 3166-1 alpha-3 code (e.g., USA, CAN)' })
	@Filterable()
	@Sortable()
	alpha3!: string

	/**
	 * ISO 3166-1 numeric code (e.g., 840 for USA, 124 for Canada).
	 * @public
	 */
	@Column({ name: 'number', type: 'integer', unique: true })
	@Searchable({ type: 'integer', weight: 6, behavior: 'exact', description: 'ISO 3166-1 numeric code (e.g., 840, 124)', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	number!: number

	/**
	 * International dialing code (e.g., 1 for US/CA).
	 * @public
	 */
	@Column({ name: 'dialing_code', type: 'integer' })
	@Searchable({ type: 'integer', weight: 5, behavior: 'exact', description: 'International dialing code (e.g., 1, 44)', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	dialingCode!: number

	/**
	 * One-to-many relationship with System.
	 * Systems that belong to this country.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('SystemEntity', 'country')
	systems?: unknown[]
}
