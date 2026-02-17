import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	AgentTaxEntity,
	TaxEntity,
	AgentEntity,
} from '@exprealty/database';
import { HmacService } from '@exprealty/encryption';
import { AgentTaxController } from './agent-tax.controller.js';
import { AgentTaxService } from './agent-tax.service.js';
import { AgentTaxTypeOrmRepository } from './agent-tax.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { AgentModule } from '../agents/agent.module.js';

/**
 * Module for AgentTax aggregate.
 *
 * Provides:
 * - AgentTaxController: Nested routes at /v1/agents/:id/taxes
 *
 * Entity Registration Chain (TypeORM requires all related entities):
 * AgentTaxEntity → TaxEntity, AgentEntity
 */
@Module({
	imports: [
		// Register entities for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			AgentTaxEntity,
			TaxEntity,
			AgentEntity,
		]),
		PaginationModule,
		// Import AgentModule to get AgentExistsGuard and AGENT_SERVICE token
		// Use forwardRef to avoid circular dependency
		forwardRef(() => AgentModule),
	],
	controllers: [
		AgentTaxController,
	],
	providers: [
		AgentTaxService,
		{
			provide: 'IAgentTaxRepository',
			useClass: AgentTaxTypeOrmRepository,
		},
		{
			provide: 'TaxIdHasher',
			useFactory: () => {
				const secret = process.env.HMAC_SECRET;
				if (!secret) {
					throw new Error('HMAC_SECRET environment variable is required');
				}
				const hmac = new HmacService({ current: secret });
				return { hash: (plaintext: string) => hmac.hash(plaintext) };
			},
		},
		ProjectionService,
	],
	exports: [AgentTaxService],
})
export class AgentTaxModule {}
