import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ExternalReferenceBase, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { PageResult } from '../../../common/ports/pagination.types.js';
import type { IExternalReferenceRepository } from './ports/external-reference.repository.port.js';
import { LoggerService, ScopedLogger } from '../../../core/logger.service.js';
import type { CreateExternalReferenceDto, UpdateExternalReferenceDto } from './dto/index.js';

@Injectable()
export class ExternalReferenceService {
	private readonly logger: ScopedLogger;

	constructor(
		@Inject('IExternalReferenceRepository')
		private readonly repo: IExternalReferenceRepository,
		logger: LoggerService,
	) {
		this.logger = logger.createScopedLogger('ExternalReferenceService');
	}

	async create(agentId: string, data: CreateExternalReferenceDto): Promise<ExternalReferenceBase> {
		const startTime = Date.now();
		const ref = await this.repo.create(agentId, {
			systemCode: data.systemCode,
			refKey: data.refKey,
			refValue: data.refValue,
			createdBy: data.createdBy,
		});
		const duration = Date.now() - startTime;
		this.logger.operational(`Created external reference ${ref.id} for agent ${agentId} in ${duration}ms`);
		return ref;
	}

	async update(agentId: string, refId: string, data: UpdateExternalReferenceDto): Promise<ExternalReferenceBase> {
		const startTime = Date.now();
		const ref = await this.repo.update(agentId, refId, {
			systemCode: data.systemCode,
			refKey: data.refKey,
			refValue: data.refValue,
			modifiedBy: data.modifiedBy,
		});

		if (!ref) {
			throw new NotFoundException({
				message: `External reference '${refId}' not found for agent '${agentId}'`,
				i18nType: 'externalReference.not_found',
			});
		}

		const duration = Date.now() - startTime;
		this.logger.operational(`Updated external reference ${refId} for agent ${agentId} in ${duration}ms`);
		return ref;
	}

	async findById(agentId: string, refId: string): Promise<ExternalReferenceBase> {
		const ref = await this.repo.findByIdForAgent(agentId, refId);
		if (!ref) {
			throw new NotFoundException({
				message: `External reference '${refId}' not found for agent '${agentId}'`,
				i18nType: 'externalReference.not_found',
			});
		}
		return ref;
	}

	async findByAgentId(
		agentId: string,
		query?: Partial<QueryParams>,
		selection?: FieldSelection,
	): Promise<PageResult<ExternalReferenceBase>> {
		const startTime = Date.now();
		const result = await this.repo.findByAgentId(agentId, query, selection);
		const duration = Date.now() - startTime;
		this.logger.debugTiered(`Fetched ${result.items.length} external references for agent ${agentId} in ${duration}ms`);
		return result;
	}
}
