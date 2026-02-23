import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	AgentCompanyAssociationEntity,
	AgentEntity,
	AgentCompanyEntity,
} from '@exprealty/database';
// AgentCompany controllers and services
import { AgentCompanyController } from './agent-company.controller.js';
import { AgentCompanyService } from './agent-company.service.js';
import { AgentCompanyTypeOrmRepository } from './agent-company.repository.js';
// AgentCompanyAssociation controllers and services
import { AgentCompanyAssociationNestedController } from './agent-company-association-nested.controller.js';
import { AgentCompanyAssociationService } from './agent-company-association.service.js';
import { AgentCompanyAssociationTypeOrmRepository } from './agent-company-association.repository.js';
import { PaginationModule } from '../../common/pagination/pagination.module.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { AgentModule } from '../agents/agent.module.js';

/**
 * Module for AgentCompany and AgentCompanyAssociation aggregates.
 * 
 * Provides:
 * - AgentCompanyController: Root CRUD at /v1/agent-companies (manages company entity)
 * - AgentCompanyAssociationNestedController: Nested routes at /v1/agents/:id/agent-companies (manages junction)
 * 
 * Entity Registration Chain (TypeORM requires all related entities):
 * AgentCompanyAssociationEntity → AgentEntity → AgentCompanyEntity
 */
@Module({
	imports: [
		// Register entities for TypeORM metadata resolution
		TypeOrmModule.forFeature([
			AgentCompanyAssociationEntity,
			AgentEntity,
			AgentCompanyEntity,
		]),
		PaginationModule,
		// Import AgentModule to get AgentExistsGuard and AGENT_SERVICE token
		// Use forwardRef to avoid circular dependency
		forwardRef(() => AgentModule),
	],
	controllers: [
		AgentCompanyController,
		AgentCompanyAssociationNestedController,
	],
	providers: [
		// AgentCompany providers
		AgentCompanyService,
		{
			provide: 'IAgentCompanyRepository',
			useClass: AgentCompanyTypeOrmRepository,
		},
		// AgentCompanyAssociation providers
		AgentCompanyAssociationService,
		{
			provide: 'IAgentCompanyAssociationRepository',
			useClass: AgentCompanyAssociationTypeOrmRepository,
		},
		ProjectionService,
	],
	exports: [AgentCompanyService, AgentCompanyAssociationService],
})
export class AgentCompanyAssociationModule {}
