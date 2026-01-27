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

			// Create new actor
			const actor = this.actorRepo.create({
				type,
				identifier,
				metadata,
				active: true,
			});

			const saved = await this.actorRepo.save(actor);
			this.logger.debug('Created new API actor', {
				actorId: saved.id,
				type,
				identifier,
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

