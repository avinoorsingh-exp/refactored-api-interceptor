import {
	Entity,
	Column,
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'

/**
 * TypeORM entity for Company table.
 * Database representation of the domain Company type.
 * @public
 */
@Entity('companies')
export class CompanyEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Company name.
	 * @public
	 */
	@Column({ type: 'text' })
	name!: string

	/**
	 * Company email address.
	 * @public
	 */
	@Column({ type: 'text', unique: true })
	email!: string

	/**
	 * Creation timestamp.
	 * @public
	 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
	createdAt!: Date

	/**
	 * Last update timestamp.
	 * @public
	 */
	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
	updatedAt!: Date
}
