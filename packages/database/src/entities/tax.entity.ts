import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for Tax table.
 * @public
 */
@Entity({ name: 'tax', schema: 'core' })
export class TaxEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'tax_id', type: 'text' })
	taxId!: string

	@Column({ type: 'text' })
	type!: string

	@Column({ type: 'text' })
	jurisdiction!: string

	@Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
	rate?: number

	@Column({ name: 'effective_date', type: 'timestamp with time zone', nullable: true })
	effectiveDate?: Date

	@Column({ name: 'expiration_date', type: 'timestamp with time zone', nullable: true })
	expirationDate?: Date
}
