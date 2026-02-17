import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { TaxEntity } from './tax.entity.js'

/**
 * TypeORM entity for AgentTax junction table.
 * Many-to-many relationship between Agent and Tax.
 *
 * An agent can have multiple tax identifiers (SSN, EIN, GSN_HST),
 * with one marked as primary for tax reporting.
 *
 * @public
 */
@Entity({ name: 'agent_tax', schema: 'core' })
export class AgentTaxEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string

	/**
	 * Foreign key to Agent.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string

	/**
	 * Foreign key to Tax.
	 * @public
	 */
	@Column({ name: 'tax_id', type: 'uuid' })
	taxId!: string

	/**
	 * Whether this is the agent's primary tax identifier.
	 * Used for tax reporting and default identification.
	 * Only one association per agent should have isPrimary = true.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean', default: false })
	isPrimary!: boolean

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity, (agent) => agent.agentTaxes)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity

	/**
	 * Many-to-One relationship with Tax.
	 * @public
	 */
	@ManyToOne(() => TaxEntity, (tax) => tax.agentTaxes)
	@JoinColumn({ name: 'tax_id' })
	tax?: TaxEntity
}
