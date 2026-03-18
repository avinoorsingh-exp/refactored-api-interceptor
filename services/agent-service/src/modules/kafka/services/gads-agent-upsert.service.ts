import { Injectable } from '@nestjs/common';
import { AgentUpsertExecutorService } from './agent-upsert-executor.service.js';

/**
 * Upsert service for Global ADS agent created/updated consumers.
 * Uses modifiedBy "Gads" for audit.
 */
@Injectable()
export class GadsAgentUpsertService {
	constructor(private readonly executor: AgentUpsertExecutorService) {}

	async upsertAgentWithAssociations(payload: unknown): Promise<void> {
		await this.executor.upsertAgentWithAssociations(payload, 'Gads');
	}
}
