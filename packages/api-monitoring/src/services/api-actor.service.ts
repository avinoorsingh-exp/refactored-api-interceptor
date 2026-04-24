import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { API_MONITORING_ACTOR_REPO } from '../tokens/repository.tokens.js';
import { ApiActorType } from '../domain/api-monitoring.types.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';

/** Actor row shape used by monitoring (matches core.api_actor). */
export type ApiActorRow = {
	id: string;
	type: ApiActorType;
	identifier?: string;
	metadata?: Record<string, unknown>;
	displayName: string;
	active: boolean;
	updatedAt?: Date;
};

/**
 * Service for managing API actors (users, API keys, service accounts).
 * @public
 */
@Injectable()
export class ApiActorService {
	private readonly logger: IApiMonitoringLogger;

	constructor(
		@Inject(API_MONITORING_ACTOR_REPO)
		private readonly actorRepo: Repository<ApiActorRow>,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiActorService');
		this.logger.info('ApiActorService initialized successfully');
	}

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

	async getOrCreateActor(
		type: ApiActorType,
		identifier?: string,
		metadata?: Record<string, unknown>,
	): Promise<ApiActorRow> {
		try {
			if (identifier) {
				const existing = await this.actorRepo.findOne({
					where: { type, identifier },
				});

				if (existing) {
					if (!existing.active) {
						await this.actorRepo.update(existing.id, {
							active: true,
							updatedAt: new Date(),
						});
						const reactivated = await this.actorRepo.findOne({
							where: { id: existing.id },
						});
						if (reactivated) {
							this.logger.debug('Reactivated previously deactivated actor', {
								actorId: reactivated.id,
								type,
								identifier,
							});
							return reactivated;
						}
					}
					return existing;
				}
			}

			const tempId = '00000000-0000-0000-0000-000000000000';
			const displayName = this.generateDisplayName(type, identifier, metadata, tempId);

			const actor = this.actorRepo.create({
				type,
				identifier,
				metadata,
				displayName,
				active: true,
			} as Parameters<Repository<ApiActorRow>['create']>[0]);

			const saved = await this.actorRepo.save(actor);

			if (type === ApiActorType.ANONYMOUS && !metadata?.ip) {
				const updatedDisplayName = this.generateDisplayName(type, identifier, metadata, saved.id);
				if (updatedDisplayName !== displayName) {
					await this.actorRepo.update(saved.id, { displayName: updatedDisplayName });
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
			if (identifier) {
				const existing = await this.actorRepo.findOne({
					where: { type, identifier },
				});

				if (existing) {
					if (!existing.active) {
						await this.actorRepo.update(existing.id, {
							active: true,
							updatedAt: new Date(),
						});
						const reactivated = await this.actorRepo.findOne({
							where: { id: existing.id },
						});
						if (reactivated) {
							return reactivated;
						}
					}
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

	async getActorById(id: string): Promise<ApiActorRow | null> {
		return this.actorRepo.findOne({
			where: { id, active: true },
		});
	}

	async deactivateActor(id: string): Promise<void> {
		await this.actorRepo.update(id, { active: false });
		this.logger.info('Deactivated API actor', { actorId: id });
	}
}
