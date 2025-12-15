import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { AuditableEntity } from './auditable.entity.js'
import { Searchable, Filterable, Sortable, SearchValidators } from '../../decorators/searchable-decorators.js'

/**
 * Social context enum values.
 * @public
 */
export type SocialContext = 'website' | 'twitter' | 'linkedin' | 'facebook'

/**
 * TypeORM entity for Social table.
 * Database representation of agent social media links.
 * Linked to PublicProfile (not directly to Agent).
 * @public
 */
@Entity({ name: 'social', schema: 'core' })
export class SocialEntity extends AuditableEntity {
	/**
	 * Primary key (BigInt).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Unique social identifier (bigint)', validate: SearchValidators.bigint })
	@Filterable()
	@Sortable()
	id!: string

	/**
	 * Foreign key to PublicProfile (UUID).
	 * @public
	 */
	@Column({ name: 'public_profile_id', type: 'uuid' })
	@Searchable({ weight: 4, behavior: 'exact', description: 'Public profile ID reference (UUID)' })
	@Filterable()
	@Sortable()
	publicProfileId!: string

	/**
	 * Social media platform/context (website, twitter, linkedin, facebook).
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 7, behavior: 'exact', description: 'Social media platform (website, twitter, linkedin, facebook)' })
	@Filterable()
	@Sortable()
	context!: SocialContext

	/**
	 * URL or handle for the social media profile.
	 * @public
	 */
	@Column({ type: 'text' })
	@Searchable({ weight: 8, behavior: 'partial', description: 'Social media URL or handle' })
	@Filterable()
	@Sortable()
	value!: string

	/**
	 * Many-to-One relationship with PublicProfile.
	 * @public
	 */
	@ManyToOne('PublicProfileEntity', 'socials')
	@JoinColumn({ name: 'public_profile_id' })
	publicProfile?: unknown
}
