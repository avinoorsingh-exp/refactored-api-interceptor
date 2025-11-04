import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AgentEntity } from './agent.entity.js'
import { PublicProfileEntity } from './public-profile.entity.js'
import { SpecialtyEntity } from './specialty.entity.js'

/**
 * TypeORM entity for AgentSpecialty join table.
 * Many-to-many relationship between Agent and Specialty.
 * @public
 */
@Entity({ name: 'agent_specialty', schema: 'core' })
export class AgentSpecialtyEntity {
	@PrimaryColumn({ name: 'agent_uuid', type: 'uuid' })
	agentUuid!: string

	@PrimaryColumn({ name: 'public_profile_id', type: 'uuid' })
	publicProfileId!: string

	@PrimaryColumn({ name: 'specialty_id', type: 'bigint' })
	specialtyId!: string

	@ManyToOne(() => AgentEntity)
	@JoinColumn({ name: 'agent_uuid' })
	agent?: AgentEntity

	@ManyToOne(() => PublicProfileEntity)
	@JoinColumn({ name: 'public_profile_id' })
	publicProfile?: PublicProfileEntity

	@ManyToOne(() => SpecialtyEntity)
	@JoinColumn({ name: 'specialty_id' })
	specialty?: SpecialtyEntity
}
