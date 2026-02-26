import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import type { IFeatureFlagRepository } from './ports/feature-flag.repository.port.js';
import type { FeatureFlagKey } from './feature-flag.constants.js';
import { isAllowedFeatureFlagKey } from './feature-flag.constants.js';
import { LoggerService } from '../../../core/logger.service.js';

@Injectable()
export class FeatureFlagService {
	constructor(
		@Inject('IFeatureFlagRepository')
		private readonly repository: IFeatureFlagRepository,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext(FeatureFlagService.name);
	}

	async getAllFlags(): Promise<{ key: FeatureFlagKey; enabled: boolean }[]> {
		const all = await this.repository.findAll();
		return all.map((f) => ({ key: f.key, enabled: f.enabled }));
	}

	async updateFlag(key: string, enabled: boolean): Promise<{ key: FeatureFlagKey; enabled: boolean }> {
		if (!isAllowedFeatureFlagKey(key)) {
			throw new BadRequestException({
				message: `Invalid feature flag key: ${key}`,
				i18nType: 'admin.feature_flag.invalid_key',
			});
		}
		const existing = await this.repository.findByKey(key as FeatureFlagKey);
		if (!existing) {
			throw new NotFoundException({
				message: `Feature flag not found: ${key}`,
				i18nType: 'admin.feature_flag.not_found',
			});
		}
		const updated = await this.repository.save({ ...existing, enabled, updatedAt: new Date() });
		this.logger.info(`Feature flag updated: ${key} enabled=${enabled}`);
		return { key: updated.key, enabled: updated.enabled };
	}

	async isEnabled(key: FeatureFlagKey): Promise<boolean> {
		const flag = await this.repository.findByKey(key);
		if (!flag) {
			throw new NotFoundException({
				message: `Feature flag not found: ${key}`,
				i18nType: 'admin.feature_flag.not_found',
			});
		}
		return flag.enabled;
	}
}
