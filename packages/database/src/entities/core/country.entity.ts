import { Country } from '@exprealty/shared-domain'
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Sortable, Filterable } from '../../decorators/searchable-decorators.js'

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
	@Searchable()
	@Filterable()
	@Sortable()
	id!: number

	/**
	 * Country name (e.g., "United States of America", "Canada").
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable()
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * ISO 3166-1 alpha-2 code (e.g., "US", "CA").
	 * @public
	 */
	@Column({ name: 'alpha_2', type: 'varchar', length: 2, unique: true })
	@Searchable()
	@Filterable()
	@Sortable()
	alpha2!: string

	/**
	 * ISO 3166-1 alpha-3 code (e.g., "USA", "CAN").
	 * @public
	 */
	@Column({ name: 'alpha_3', type: 'varchar', length: 3, unique: true })
	@Searchable()
	@Filterable()
	@Sortable()
	alpha3!: string

	/**
	 * ISO 3166-1 numeric code (e.g., 840 for USA, 124 for Canada).
	 * @public
	 */
	@Column({ name: 'number', type: 'integer', unique: true })
	@Searchable()
	@Filterable()
	@Sortable()
	number!: number

	/**
	 * International dialing code (e.g., 1 for US/CA).
	 * @public
	 */
	@Column({ name: 'dialing_code', type: 'integer' })
	@Searchable()
	@Filterable()
	@Sortable()
	dialingCode!: number
}
