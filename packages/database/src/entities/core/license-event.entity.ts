import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { LicenseEntity } from './license.entity.js'

/**
 * TypeORM entity for LicenseEvent table.
 * @public
 */
@Entity({ name: 'license_event', schema: 'core' })
export class LicenseEventEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'license_id', type: 'uuid' })
	licenseId!: string

	@Column({ type: 'text' })
	actor!: string

	@Column({ type: 'timestamp with time zone' })
	date!: Date

	@Column({ type: 'text' })
	type!: 'Broker Approval' | 'License Verification' | 'Override' | 'Transfer'

	@Column({ type: 'text' })
	status!:
		| 'Approve'
		| 'Rejected'
		| 'Complete'
		| 'Inactive'
		| 'Other'
		| 'Secondary State LOI'
		| 'Pending'
		| 'Transferred'
		| 'Overridden'

	@ManyToOne(() => LicenseEntity)
	@JoinColumn({ name: 'license_id' })
	license?: LicenseEntity
}
