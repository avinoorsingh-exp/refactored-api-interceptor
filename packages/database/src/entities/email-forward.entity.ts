import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

/**
 * TypeORM entity for EmailForward table.
 * Database representation of email forwarding configuration.
 * @public
 */
@Entity('email_forwards')
export class EmailForwardEntity {
	/**
	 * Auto-incrementing primary key.
	 * @public
	 */
	@PrimaryGeneratedColumn('increment')
	id!: number

	/**
	 * Recipient identifier.
	 * @public
	 */
	@Column({ name: 'recipient_id', type: 'text' })
	recipientId!: string

	/**
	 * Timestamp of last verification check.
	 * @public
	 */
	@Column({
		name: 'verified_last_checked',
		type: 'timestamp with time zone',
		nullable: true,
	})
	verifiedLastChecked?: Date

	/**
	 * Whether the email forward has been verified.
	 * @public
	 */
	@Column({ type: 'boolean', default: false })
	verified!: boolean

	/**
	 * Timestamp when the email forward was created.
	 * @public
	 */
	@Column({ type: 'timestamp with time zone' })
	created!: Date

	/**
	 * Forward identifier in external system.
	 * @public
	 */
	@Column({ name: 'forward_id', type: 'text' })
	forwardId!: string

	/**
	 * Timestamp when recipient was created.
	 * @public
	 */
	@Column({ name: 'recipient_created', type: 'timestamp with time zone', nullable: true })
	recipientCreated?: Date

	/**
	 * Date when verification occurred.
	 * @public
	 */
	@Column({ name: 'verified_date', type: 'timestamp with time zone', nullable: true })
	verifiedDate?: Date

	/**
	 * Language preference.
	 * @public
	 */
	@Column({ type: 'text', nullable: true })
	language?: string
}
