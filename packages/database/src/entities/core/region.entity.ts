import { Entity, PrimaryGeneratedColumn, Column, OneToMany, JoinColumn } from 'typeorm'
import { StateEntity } from './state.entity.js'
import { AuditableEntity } from './auditable.entity.js'
import type { Region } from '@exprealty/shared-domain'
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js';

/**
 * TypeORM entity for Region table.
 * @public
 */
@Entity({ name: 'region', schema: 'core' })
export class RegionEntity extends AuditableEntity implements Region {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique region identifier' })
	@Filterable()
	@Sortable()
	id!: string

	@Column({ type: 'text', unique: true })
	@Searchable({ weight: 10, behavior: 'partial', description: 'Region display name' })
	@Filterable()
	@Sortable()
	name!: string
}
