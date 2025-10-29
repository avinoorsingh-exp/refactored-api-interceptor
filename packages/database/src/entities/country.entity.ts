import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for Country table.
 * Stores ISO 3166-1 country reference data.
 * @public
 */
@Entity('countries')
export class CountryEntity {
	/**
	 * Primary key with auto-increment integer.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'integer', name: 'country_id' })
	countryId!: number

	/**
	 * Country name (e.g., "United States of America", "Canada").
	 * @public
	 */
	@Column({ type: 'text' })
	name!: string

	/**
	 * ISO 3166-1 alpha-2 code (e.g., "US", "CA").
	 * @public
	 */
	@Column({ name: 'alpha_2', type: 'varchar', length: 2, unique: true })
	alpha2!: string

	/**
	 * ISO 3166-1 alpha-3 code (e.g., "USA", "CAN").
	 * @public
	 */
	@Column({ name: 'alpha_3', type: 'varchar', length: 3, unique: true })
	alpha3!: string

	/**
	 * ISO 3166-1 numeric code (e.g., 840 for USA, 124 for Canada).
	 * @public
	 */
	@Column({ name: 'number', type: 'integer', unique: true })
	number!: number

	/**
	 * International dialing code (e.g., 1 for US/CA).
	 * @public
	 */
	@Column({ name: 'dialing_code', type: 'integer' })
	dialingCode!: number
}
