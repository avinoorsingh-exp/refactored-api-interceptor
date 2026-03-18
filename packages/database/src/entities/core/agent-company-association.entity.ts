import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AgentEntity } from './agent.entity.js';
import { AgentCompanyEntity } from './agent-company.entity.js';

/**
 * TypeORM entity for AgentCompanyAssociation junction table.
 * Many-to-many relationship between Agent and AgentCompany.
 *
 * An agent can be associated with multiple companies (brokerages),
 * with one marked as primary for commission payments.
 *
 * @public
 */
@Entity({ name: 'agent_company_association', schema: 'core' })
export class AgentCompanyAssociationEntity {
	/**
	 * Primary key (UUID).
	 * @public
	 */
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/**
	 * Foreign key to Agent.
	 * @public
	 */
	@Column({ name: 'agent_id', type: 'uuid' })
	agentId!: string;

	/**
	 * Foreign key to AgentCompany.
	 * @public
	 */
	@Column({ name: 'agent_company_id', type: 'uuid' })
	agentCompanyId!: string;

	/**
	 * Whether this is the agent's primary company.
	 * Used for commission payments and primary brokerage identification.
	 * Only one association per agent should have isPrimary = true.
	 * @public
	 */
	@Column({ name: 'is_primary', type: 'boolean', default: false })
	isPrimary!: boolean;

	// ==========================================
	// RELATIONSHIPS
	// ==========================================

	/**
	 * Many-to-One relationship with Agent.
	 * @public
	 */
	@ManyToOne(() => AgentEntity, (agent) => agent.agentCompanyAssociations)
	@JoinColumn({ name: 'agent_id' })
	agent?: AgentEntity;

	/**
	 * Many-to-One relationship with AgentCompany.
	 * @public
	 */
	@ManyToOne(() => AgentCompanyEntity, (company) => company.agentAssociations)
	@JoinColumn({ name: 'agent_company_id' })
	agentCompany?: AgentCompanyEntity;
}
