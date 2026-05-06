import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { API_MONITORING_USER_REPO } from '../tokens/repository.tokens.js';
import { tryParseUuidString } from '../utils/try-parse-uuid-string.util.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';

export type ApiMonitoringUserRow = {
	id: string;
	actorId: string;
	externalId: string;
	userUuid?: string;
	email?: string;
	lastSourceApplication?: string;
	createdAt?: Date;
	updatedAt?: Date;
};

/**
 * Persists / updates `core.api_monitoring_user` for human users (links email + external id to `api_actor`).
 * @public
 */
@Injectable()
export class ApiMonitoringUserService {
	private readonly logger: IApiMonitoringLogger;

	constructor(
		@Inject(API_MONITORING_USER_REPO)
		private readonly userRepo: Repository<Record<string, unknown>>,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiMonitoringUserService');
	}

	/**
	 * Upsert by `externalId` (IdP subject or stable user key). Never throws to the HTTP pipeline.
	 */
	async upsertForUserActor(params: {
		externalId: string;
		email?: string;
		actorId: string;
		/** When set (e.g. from `x-source-app`), updates `last_source_application` on the profile. */
		sourceApplication?: string;
	}): Promise<ApiMonitoringUserRow | undefined> {
		const externalId = params.externalId.trim();
		if (!externalId) {
			return undefined;
		}

		const userUuid = tryParseUuidString(externalId);

		try {
			const existing = await this.userRepo.findOne({
				where: { externalId },
			});

			if (existing) {
				const row = existing;
				const patch: Record<string, unknown> = {
					actorId: params.actorId,
					updatedAt: new Date(),
				};
				if (params.email !== undefined) {
					patch.email = params.email;
				}
				if (userUuid !== undefined) {
					patch.userUuid = userUuid;
				}
				if (params.sourceApplication !== undefined) {
					patch.lastSourceApplication = params.sourceApplication;
				}
				Object.assign(row, patch);
				const saved = await this.userRepo.save(row);
				return this.mapRow(saved);
			}

			const created = this.userRepo.create({
				actorId: params.actorId,
				externalId,
				userUuid,
				email: params.email,
				lastSourceApplication: params.sourceApplication,
			} as Record<string, unknown>);
			const saved = await this.userRepo.save(created);
			return this.mapRow(saved);
		} catch (err: unknown) {
			this.logger.warn('Failed to upsert api_monitoring_user', {
				externalId,
				error: err instanceof Error ? err.message : String(err),
			});
			return undefined;
		}
	}

	private mapRow(r: Record<string, unknown>): ApiMonitoringUserRow {
		return {
			id: r.id as string,
			actorId: r.actorId as string,
			externalId: r.externalId as string,
			userUuid: r.userUuid as string | undefined,
			email: r.email as string | undefined,
			lastSourceApplication: r.lastSourceApplication as string | undefined,
			createdAt: r.createdAt as Date | undefined,
			updatedAt: r.updatedAt as Date | undefined,
		};
	}
}
