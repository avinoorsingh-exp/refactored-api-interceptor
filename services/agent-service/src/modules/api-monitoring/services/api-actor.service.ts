import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiActorEntity } from '@exprealty/database';
import { ApiActorType } from '@exprealty/shared-domain';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Service for managing API actors (users, API keys, service accounts).
 * 
 * Handles actor creation, lookup, and caching for request attribution.
 * Actors are created on-demand when first seen in requests.
 * 
 * @public
 */
@Injectable()
export class ApiActorService {
	private readonly logger: LoggerService;

	constructor(
		@InjectRepository(ApiActorEntity)
		private readonly actorRepo: Repository<ApiActorEntity>,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('ApiActorService');
	}

	/**
	 * Get or create an actor by type and identifier.
	 * Uses upsert pattern to avoid race conditions.
	 * 
	 * @param type - Actor type
	 * @param identifier - Human-readable identifier (email, API key name, etc.)
	 * @param metadata - Optional metadata
	 * @returns Actor entity
	 */
	async getOrCreateActor(
		type: ApiActorType,
		identifier?: string,
		metadata?: Record<string, unknown>,
	): Promise<ApiActorEntity> {
		// CRITICAL: identifier is REQUIRED for stable actor resolution
		// All actors must have an identifier to ensure stable identity across requests
		if (!identifier) {
			throw new Error(
				'Actor identifier is required for stable resolution. All actors must have an identifier.',
			);
		}

		// HARD STOP: In local development (NODE_ENV === 'local'), ONLY LOCAL_DOCKER_ACTOR is allowed
		// ANY attempt to create a different actor MUST CRASH THE APP
		const isLocal = this.isLocalDockerEnvironment();
		if (isLocal && identifier !== 'LOCAL_DOCKER_ACTOR') {
			const errorMessage = `ILLEGAL ACTOR CREATION IN LOCAL DEVELOPMENT: Attempted to create actor with identifier "${identifier}" (type: ${type}). Only "LOCAL_DOCKER_ACTOR" is allowed in local development (NODE_ENV === 'local'). This is a correctness violation - the app will crash.`;
			this.logger.error(errorMessage, {
				attemptedIdentifier: identifier,
				attemptedType: type,
				metadata,
			});
			throw new Error(errorMessage);
		}

		try {
			// Try to find existing actor by type and identifier
			// This ensures stable identity: same identifier → same actor
			const existing = await this.actorRepo.findOne({
				where: { type, identifier, active: true },
			});

			if (existing) {
				return existing;
			}

			// Generate display name before creating actor
			const tempId = '00000000-0000-0000-0000-000000000000';
			const displayName = this.generateDisplayName(type, identifier, metadata, tempId);

			// Create new actor
			const actor = this.actorRepo.create({
				type,
				identifier,
				metadata,
				displayName,
				active: true,
			});

			const saved = await this.actorRepo.save(actor);

			// Update displayName with actual ID if needed
			const updatedDisplayName = this.generateDisplayName(
				type,
				identifier,
				metadata,
				saved.id,
			);
			if (updatedDisplayName !== displayName) {
				await this.actorRepo.update(saved.id, { displayName: updatedDisplayName });
				saved.displayName = updatedDisplayName;
			}

			this.logger.debug('Created new API actor', {
				actorId: saved.id,
				type,
				identifier,
				displayName: saved.displayName,
			});

			return saved;
		} catch (error) {
			// Handle race condition: actor created between find and save
			// This can happen in high-concurrency scenarios
			const existing = await this.actorRepo.findOne({
				where: { type, identifier, active: true },
			});

			if (existing) {
				return existing;
			}

			this.logger.error('Failed to get or create actor', {
				type,
				identifier,
				error: error instanceof Error ? error.message : String(error),
			});

			throw error;
		}
	}

	/**
	 * Generate display name for an actor based on type, identifier, and metadata.
	 */
	private generateDisplayName(
		type: ApiActorType,
		identifier?: string,
		metadata?: Record<string, unknown>,
		actorId?: string,
	): string {
		switch (type) {
			case ApiActorType.USER:
				return identifier || 'User';
			
			case ApiActorType.API_KEY: {
				const apiKeyName = metadata?.apiKeyName as string | undefined;
				const apiKeyId = metadata?.apiKeyId as string | undefined;
				const name = apiKeyName || apiKeyId || identifier;
				return `API Key: ${name || (actorId ? actorId.substring(0, 8) : 'Unknown')}`;
			}
			
			case ApiActorType.SERVICE_ACCOUNT: {
				const serviceAccountId = metadata?.serviceAccountId as string | undefined;
				const id = serviceAccountId || identifier || (actorId ? actorId.substring(0, 8) : 'Unknown');
				return `Service: ${id}`;
			}
			
			case ApiActorType.SYSTEM:
				// For LOCAL_DOCKER_ACTOR, use a descriptive name
				if (identifier === 'LOCAL_DOCKER_ACTOR') {
					return 'Local Docker Developer';
				}
				// For LOCAL_DEV_ACTOR, use a descriptive name
				if (identifier === 'LOCAL_DEV_ACTOR') {
					return 'Local Development';
				}
				return 'System';
			
			case ApiActorType.ANONYMOUS: {
				// For constant ANONYMOUS identifier, use a generic name
				if (identifier === 'ANONYMOUS') {
					return 'Anonymous';
				}
				const ip = metadata?.ip as string | undefined;
				const shortId = actorId ? actorId.substring(0, 8) : 'unknown';
				return `Anonymous (${ip || shortId})`;
			}
			
			default:
				return identifier || 'Unknown';
		}
	}

	/**
	 * Get actor by ID.
	 */
	async getActorById(id: string): Promise<ApiActorEntity | null> {
		return this.actorRepo.findOne({
			where: { id, active: true },
		});
	}

	/**
	 * Deactivate an actor (soft delete).
	 */
	async deactivateActor(id: string): Promise<void> {
		await this.actorRepo.update(id, { active: false });
		this.logger.info('Deactivated API actor', { actorId: id });
	}

	/**
	 * Check if running in local development environment.
	 * 
	 * CRITICAL: Only activates when NODE_ENV === 'local'
	 * This ensures hard stops NEVER run in AWS dev/test/prod environments.
	 * 
	 * @returns true if NODE_ENV === 'local'
	 */
	private isLocalDockerEnvironment(): boolean {
		return process.env.NODE_ENV === 'local';
	}

	/**
	 * Assert that actor count is exactly 1 in local development mode.
	 * Called during application startup.
	 * 
	 * CRITICAL: Only runs when NODE_ENV === 'local' - NEVER in AWS dev/test/prod
	 * 
	 * @throws Error if actor count > 1 in local development mode
	 */
	async assertLocalDockerActorCardinality(): Promise<void> {
		const isLocal = this.isLocalDockerEnvironment();
		if (!isLocal) {
			return; // Only check in local development (NODE_ENV === 'local')
		}

		const actors = await this.actorRepo.find({
			where: { active: true },
		});

		if (actors.length > 1) {
			const actorIds = actors.map((a) => ({
				id: a.id,
				type: a.type,
				identifier: a.identifier,
				displayName: a.displayName,
			}));

			const errorMessage = `ACTOR CARDINALITY VIOLATION IN LOCAL DEVELOPMENT: Found ${actors.length} actors, but only 1 is allowed. Actor IDs: ${JSON.stringify(actorIds, null, 2)}`;
			this.logger.error(errorMessage, { actorCount: actors.length, actors: actorIds });
			throw new Error(errorMessage);
		}

		this.logger.info('Local development actor cardinality check passed', {
			actorCount: actors.length,
		});
	}
}

