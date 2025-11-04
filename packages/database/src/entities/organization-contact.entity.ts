import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for OrganizationContact table.
 * @public
 */
@Entity({ name: 'organization_contact', schema: 'core' })
export class OrganizationContactEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	email?: string

	@Column({ type: 'text', nullable: true })
	phone?: string

	@Column({ type: 'text', nullable: true })
	address?: string
}
