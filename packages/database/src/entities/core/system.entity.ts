import type { System } from '@exprealty/shared-domain'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Sortable, Filterable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * TypeORM entity for System table.
 * Represents a system configuration within a country, including its associated currency.
 * @public
 */
@Entity({ name: 'system', schema: 'core' })
@Index('idx_system_country', ['countryId'])
@Index('idx_system_currency', ['currencyId'])
export class SystemEntity extends AuditableEntity implements System {
	/**
	 * Primary key with auto-increment bigint (stored as string in JS).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint', name: 'id' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique system identifier', validate: SearchValidators.integer })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Foreign key to the Country.
	 * @public
	 */
	@Column({ name: 'country_id', type: 'integer' })
	@Filterable()
	@Sortable()
	countryId!: number

	/**
	 * Foreign key to the Currency.
	 * @public
	 */
	@Column({ name: 'currency_id', type: 'integer' })
	@Filterable()
	@Sortable()
	currencyId!: number

	/**
	 * Description of the system.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'System description' })
	@Filterable()
	@Sortable()
	description!: string

	/**
	 * Many-to-one relationship with Country.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@ManyToOne('CountryEntity')
	@JoinColumn({ name: 'country_id' })
	country?: unknown

	/**
	 * Many-to-one relationship with Currency.
	 * Uses string name to avoid circular dependency at module load time.
	 */
	@ManyToOne('CurrencyEntity')
	@JoinColumn({ name: 'currency_id' })
	currency?: unknown
}
