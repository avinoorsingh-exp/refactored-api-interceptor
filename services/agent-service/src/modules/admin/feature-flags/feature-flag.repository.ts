import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from '@exprealty/database';
import type { IFeatureFlagRepository, FeatureFlagRecord } from './ports/feature-flag.repository.port.js';
import type { FeatureFlagKey } from './feature-flag.constants.js';

function toRecord(entity: FeatureFlagEntity): FeatureFlagRecord {
	return {
		id: entity.id,
		key: entity.key as FeatureFlagKey,
		enabled: entity.enabled,
		createdAt: entity.createdAt,
		updatedAt: entity.updatedAt,
	};
}

@Injectable()
export class FeatureFlagRepository implements IFeatureFlagRepository {
	constructor(
		@InjectRepository(FeatureFlagEntity)
		private readonly repo: Repository<FeatureFlagEntity>,
	) {}

	async findAll(): Promise<FeatureFlagRecord[]> {
		const entities = await this.repo.find({ order: { key: 'ASC' } });
		return entities.map(toRecord);
	}

	async findByKey(key: FeatureFlagKey): Promise<FeatureFlagRecord | null> {
		const entity = await this.repo.findOne({ where: { key } });
		return entity ? toRecord(entity) : null;
	}

	async save(flag: FeatureFlagRecord): Promise<FeatureFlagRecord> {
		const entity = this.repo.create({
			id: flag.id,
			key: flag.key,
			enabled: flag.enabled,
			createdAt: flag.createdAt,
			updatedAt: flag.updatedAt,
		});
		const saved = await this.repo.save(entity);
		return toRecord(saved);
	}
}
