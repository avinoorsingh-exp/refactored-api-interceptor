import type { Currency } from '@exprealty/shared-domain'
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Sortable, Filterable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for Currency table.
 * Stores ISO 4217 currency reference data.
 * @public
 */
@Entity({ name: 'currency', schema: 'core' })
export class CurrencyEntity extends AuditableEntity implements Currency {
	/**
	 * Primary key with auto-increment integer.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'integer', name: 'id' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique currency identifier', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	id!: number

	/**
	 * ISO 4217 alpha-3 currency code (e.g., "USD", "EUR").
	 * @public
	 */
	@Column({ type: 'varchar', length: 3, unique: true })
	@Searchable({ weight: 10, behavior: 'exact', description: 'ISO 4217 alpha-3 code (e.g., USD, EUR)' })
	@Filterable()
	@Sortable()
	code!: string

	/**
	 * ISO 4217 numeric code (e.g., 840 for USD, 978 for EUR).
	 * @public
	 */
	@Column({ type: 'integer', unique: true })
	@Searchable({ type: 'integer', weight: 6, behavior: 'exact', description: 'ISO 4217 numeric code (e.g., 840, 978)', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	number!: number

	/**
	 * Currency name (e.g., "US Dollar", "Euro").
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Currency display name' })
	@Filterable()
	@Sortable()
	name!: string

	/**
	 * Currency symbol (e.g., "$", "€").
	 * @public
	 */
	@Column({ type: 'varchar', length: 10, nullable: true })
	@Filterable()
	@Sortable()
	symbol?: string

	/**
	 * Number of minor units (decimal places) for the currency.
	 * Most currencies have 2 (e.g., USD), some have 0 (e.g., JPY), others have 3.
	 * @public
	 */
	@Column({ name: 'minor_units', type: 'integer', default: 2 })
	@Searchable({ type: 'integer', weight: 2, behavior: 'exact', description: 'Number of decimal places', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	minorUnits!: number

	/**
	 * One-to-many relationship with System.
	 * Systems that use this currency.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@OneToMany('SystemEntity', 'currency')
	systems?: unknown[]
}
