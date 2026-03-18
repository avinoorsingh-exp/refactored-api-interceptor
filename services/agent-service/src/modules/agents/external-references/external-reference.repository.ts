import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExternalReferenceEntity, AgentExternalReferenceEntity } from '@exprealty/database';
import type { ExternalReferenceBase, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import type { IExternalReferenceRepository } from './ports/external-reference.repository.port.js';

@Injectable()
export class ExternalReferenceTypeOrmRepository implements IExternalReferenceRepository {
	constructor(
		@InjectRepository(ExternalReferenceEntity)
		private readonly extRefRepo: Repository<ExternalReferenceEntity>,
		@InjectRepository(AgentExternalReferenceEntity)
		private readonly junctionRepo: Repository<AgentExternalReferenceEntity>,
		private readonly dataSource: DataSource,
	) {}

	private mapToDomain(entity: ExternalReferenceEntity): ExternalReferenceBase {
		return {
			id: entity.id,
			systemCode: entity.systemCode,
			refKey: entity.refKey,
			refValue: entity.refValue,
			createdBy: entity.createdBy,
			created: entity.created,
			lastModified: entity.lastModified,
			modifiedBy: entity.modifiedBy,
		} as ExternalReferenceBase;
	}

	async create(agentId: string, data: {
		systemCode: string;
		refKey: string;
		refValue: string;
		createdBy?: string;
	}): Promise<ExternalReferenceBase> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const entity = queryRunner.manager.create(ExternalReferenceEntity, {
				systemCode: data.systemCode,
				refKey: data.refKey,
				refValue: data.refValue,
				createdBy: data.createdBy ?? 'system',
			});
			const saved = await queryRunner.manager.save(entity);

			const junction = queryRunner.manager.create(AgentExternalReferenceEntity, {
				agentId,
				externalReferenceId: saved.id,
			});
			await queryRunner.manager.save(junction);

			await queryRunner.commitTransaction();
			return this.mapToDomain(saved);
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	async update(agentId: string, refId: string, data: {
		systemCode?: string;
		refKey?: string;
		refValue?: string;
		modifiedBy?: string;
	}): Promise<ExternalReferenceBase | null> {
		const junction = await this.junctionRepo.findOne({
			where: { agentId, externalReferenceId: refId },
			relations: ['externalReference'],
		});

		if (!junction?.externalReference) return null;

		const entity = junction.externalReference;
		if (data.systemCode !== undefined) entity.systemCode = data.systemCode;
		if (data.refKey !== undefined) entity.refKey = data.refKey;
		if (data.refValue !== undefined) entity.refValue = data.refValue;
		if (data.modifiedBy !== undefined) entity.modifiedBy = data.modifiedBy;

		const saved = await this.extRefRepo.save(entity);
		return this.mapToDomain(saved);
	}

	async findByIdForAgent(agentId: string, refId: string): Promise<ExternalReferenceBase | null> {
		const junction = await this.junctionRepo.findOne({
			where: { agentId, externalReferenceId: refId },
			relations: ['externalReference'],
		});

		if (!junction?.externalReference) return null;
		return this.mapToDomain(junction.externalReference);
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		_selection?: FieldSelection,
	): Promise<PageResult<ExternalReferenceBase>> {
		const offset = query?.offset ?? 0;
		const limit = Math.min(query?.limit ?? 25, 50);

		const qb = this.junctionRepo
			.createQueryBuilder('aer')
			.innerJoinAndSelect('aer.externalReference', 'extRef')
			.where('aer.agent_id = :agentId', { agentId })
			.orderBy('extRef.created', 'DESC')
			.skip(offset)
			.take(limit);

		const [junctions, total] = await qb.getManyAndCount();

		return {
			items: junctions
				.filter((j) => j.externalReference != null)
				.map((j) => this.mapToDomain(j.externalReference!)),
			total,
		};
	}
}
