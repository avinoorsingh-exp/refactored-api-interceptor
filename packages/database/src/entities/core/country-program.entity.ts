import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { CountryEntity } from './country.entity.js'
import { ProgramEntity } from './program.entity.js'

/**
 * TypeORM entity for CountryProgram table.
 * Junction table linking Countries to Programs with an allowed flag.
 * Replaces the previous StateProgram entity for country-based program management.
 * @public
 */
@Entity({ name: 'country_program', schema: 'core' })
export class CountryProgramEntity {
	/**
	 * Foreign key to Country (part of composite PK).
	 * @public
	 */
	@PrimaryColumn({ name: 'country_id', type: 'integer' })
	countryId!: number

	/**
	 * Foreign key to Program (part of composite PK).
	 * @public
	 */
	@PrimaryColumn({ name: 'program_id', type: 'bigint' })
	programId!: bigint

	/**
	 * Whether the program is allowed in this country.
	 * @public
	 */
	@Column({ type: 'boolean', default: true })
	allowed!: boolean

	/**
	 * Many-to-One relationship with Country.
	 * @public
	 */
	@ManyToOne(() => CountryEntity)
	@JoinColumn({ name: 'country_id' })
	country?: CountryEntity

	/**
	 * Many-to-One relationship with Program.
	 * @public
	 */
	@ManyToOne(() => ProgramEntity, (program) => program.countryPrograms)
	@JoinColumn({ name: 'program_id' })
	program?: ProgramEntity
}