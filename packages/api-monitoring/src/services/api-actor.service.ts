import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiActorEntity } from '@exprealty/database';
import { ApiActorType } from '@exprealty/shared-domain';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';

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
	private readonly logger: IApiMonitoringLogger;

	constructor(
		@InjectRepository(ApiActorEntity)
		private readonly actorRepo: Repository<ApiActorEntity>,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiActorService');
		this.logger.info('ApiActorService initialized successfully');
	}

	/**
	 * Generate display name for an actor based on type, identifier, and metadata.
	 * 
	 * Rules:
	 * - USER → email or username from identifier
	 * - API_KEY → "API Key: <apiKeyName || apiKeyId>"
	 * - SERVICE_ACCOUNT → "Service: <serviceAccountId>"
	 * - SYSTEM → "System"
	 * - ANONYMOUS → "Anonymous (<ip>)"
	 * 
	 * @param type - Actor type
	 * @param identifier - Human-readable identifier
	 * @param metadata - Optional metadata
	 * @param actorId - Actor ID (for fallback in anonymous case)
	 * @returns Display name string
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
				return 'System';
			
			case ApiActorType.ANONYMOUS: {
				const ip = metadata?.ip as string | undefined;
				const shortId = actorId ? actorId.substring(0, 8) : 'unknown';
				return `Anonymous (${ip || shortId})`;
			}
			
			default:
				return identifier || 'Unknown';
		}
	}

	/**
	 * Get or create an actor by type and identifier.
	 * Uses upsert pattern to avoid race conditions.
	 * 
	 * Always sets displayName at creation time based on type, identifier, and metadata.
	 * displayName is never updated per request - only when actor metadata changes.
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
		try {
			// Try to find existing actor
			if (identifier) {
				const existing = await this.actorRepo.findOne({
					where: { type, identifier, active: true },
				});

				if (existing) {
					return existing;
				}
			}

			// Generate display name before creating actor
			// For anonymous actors without IP, we'll use a placeholder and update after save
			const tempId = '00000000-0000-0000-0000-000000000000';
			let displayName = this.generateDisplayName(type, identifier, metadata, tempId);

			// Create new actor
			const actor = this.actorRepo.create({
				type,
				identifier,
				metadata,
				displayName,
				active: true,
			});

			const saved = await this.actorRepo.save(actor);
			
			// For anonymous actors, update displayName with actual ID if needed
			if (type === ApiActorType.ANONYMOUS && !metadata?.ip) {
				const updatedDisplayName = this.generateDisplayName(type, identifier, metadata, saved.id);
				if (updatedDisplayName !== displayName) {
					await this.actorRepo.update(saved.id, { displayName: updatedDisplayName });
					// Update the saved entity for return
					saved.displayName = updatedDisplayName;
				}
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
			if (identifier) {
				const existing = await this.actorRepo.findOne({
					where: { type, identifier, active: true },
				});

				if (existing) {
					return existing;
				}
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
}

