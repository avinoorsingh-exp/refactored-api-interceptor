import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for Country table.
 * @public
 */
@Entity('countries')
export class CountryEntity {
	@PrimaryGeneratedColumn('increment', { type: 'integer' })
	countryId!: number

	@Column({ type: 'text' })
	name!: string

	@Column({ name: 'two_letter_code', type: 'varchar', length: 2 })
	twoLetterCode!: string

	@Column({ name: 'iso_3166', type: 'text', nullable: true })
	iso3166?: string

	@Column({ name: 'dialing_code', type: 'integer', nullable: true })
	dialingCode?: number

	@Column({ name: 'system_id', type: 'integer', nullable: true })
	systemId?: number
}
