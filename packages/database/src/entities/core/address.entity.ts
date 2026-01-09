import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	ManyToOne,
	JoinColumn,
} from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { StateEntity } from './state.entity.js'

/**
 * TypeORM entity for Address table.
 * Database representation of domain Address type from @exprealty/shared-domain.
 * Persists ISO 3166 country codes and regional data.
 * @public
 */
@Entity({ name: 'address', schema: 'core' })
export class AddressEntity extends AuditableEntity {
	/**
	 * Primary key (BigInt auto-increment).
	 * Stored as string in TypeScript for JSON serialization compatibility.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	id!: string

	/**
	 * Address type (personal, company).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	type?: string

	/**
	 * Address role (contact, bill_to, pay_to, ship_to, return_to).
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	role?: string

	/**
	 * Address line 1 (street address).
	 * @public
	 */
	@Column({ name: 'line_1', type: 'text' })
	line1!: string

	/**
	 * Address line 2 (apt, suite, etc.) - optional.
	 * @public
	 */
	@Column({ name: 'line_2', type: 'text', nullable: true })
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
	@Column({ type: 'text', nullable: true })
	unit?: string

	/**
	 * Postal/ZIP code.
	 * @public
	 */
	@Column({ name: 'postal_code', type: 'text' })
	postalCode!: string

	/**
	 * County name - optional.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	county?: string

	/**
	 * Address label for user display - optional.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	label?: string

	/**
	 * Foreign key to State entity.
	 * Optional - addresses may not have a state (e.g., international addresses).
	 * @public
	 */
	@Column({ name: 'state_id', type: 'uuid', nullable: true })
	stateId?: string

	/**
	 * Many-to-One relationship with State.
	 * @public
	 */
	@ManyToOne(() => StateEntity)
	@JoinColumn({ name: 'state_id' })
	state?: StateEntity
}
