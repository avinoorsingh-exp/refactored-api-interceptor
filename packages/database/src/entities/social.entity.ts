import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

/**
 * TypeORM entity for Social table.
 * Database representation of agent social media links.
 * @public
 */
@Entity({ name: 'social', schema: 'core' })
export class SocialEntity {
	/**
	 * Primary key (BigInt).
	 * @public
	 */
	@PrimaryGeneratedColumn('increment')
	id!: string

	/**
	 * Social media platform/context (website, twitter, linkedin, facebook).
	 * @public
	 */
	@Column({ type: 'text' })
	context!: 'website' | 'twitter' | 'linkedin' | 'facebook'

	/**
	 * URL or handle for the social media profile.
	 * @public
	 */
	@Column({ type: 'text' })
	value!: string
}
