import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'

/**
 * TypeORM entity for Address table.
 * Database representation of the domain Address type.
 * @public
 */
@Entity('addresses')
export class AddressEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Address line 1 (street address).
	 * @public
	 */
	@Column({ name: 'line1', type: 'text' })
	line1!: string

	/**
	 * Address line 2 (apt, suite, etc.) - optional.
	 * @public
	 */
	@Column({ name: 'line2', type: 'text', nullable: true })
	line2?: string

	/**
	 * City name.
	 * @public
	 */
	@Column({ type: 'text' })
	city!: string

	/**
	 * Unit/apartment number - optional.
	 * @public
	 */
	@Column({ type: 'text' })
	unit!: string

	/**
	 * Postal/ZIP code.
	 * @public
	 */
	@Column({ name: 'postal_code', type: 'text' })
	postalCode!: string

	/**
	 * ISO-3166 alpha-2 country code.
	 * @public
	 */
	@Column({ type: 'char', length: 2 })
	country!: string

	/**
	 * Timestamp when record was created (UTC).
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	/**
	 * Timestamp when record was last updated (UTC).
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date
}
