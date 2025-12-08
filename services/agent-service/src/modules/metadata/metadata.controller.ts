import {
	Controller,
	Get,
	Param,
	Req,
	Inject,
	NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MetadataService, EntityMetadataResponse } from './metadata.service.js';
import { EntityRegistry } from '../../common/database/entity-registry.service.js';

/**
 * Metadata Controller
 * 
 * Provides API capabilities metadata for building dynamic UIs.
 * Single controller handles all entity metadata requests.
 * 
 * Note: Responses are cached internally by MetadataService for 1 hour.
 * 
 * Endpoints:
 * - GET /v1/:entity/metadata - Complete metadata for entity
 * - GET /v1/:entity/metadata/search - Searchable fields only
 * - GET /v1/:entity/metadata/filters - Filterable fields only
 * - GET /v1/:entity/metadata/sort - Sortable fields only
 * - GET /v1/metadata/entities - List all available entities
 * 
 * @example
 * GET /v1/countries/metadata
 * GET /v1/countries/metadata/search
 * GET /v1/metadata/entities
 */
@ApiTags('metadata')
@Controller('v1')
export class MetadataController {
	constructor(
		private readonly metadataService: MetadataService,
		private readonly entityRegistry: EntityRegistry,
		@Inject('ENTITY_REGISTRY_INIT') private readonly _init: EntityRegistry, // Ensures registration runs
	) {}

	/**
	 * GET /v1/metadata/entities
	 * List all available entities with their metadata URLs
	 */
	@Get('metadata/entities')
	@ApiOperation({
		summary: 'List all entities with metadata URLs',
		description: 'Returns a list of all entities that have metadata available',
	})
	getAllEntities(@Req() req: Request) {
		const baseUrl = this.getBaseUrl(req);
		const entities = this.entityRegistry.getNames();

		return {
			total: entities.length,
			entities: entities.map((name) => ({
				name,
				metadataUrl: `${baseUrl}/${name}/metadata`,
				apiUrl: `${baseUrl}/${name}`,
			})),
		};
	}

	/**
	 * GET /v1/:entity/metadata
	 * Complete metadata for an entity (searchable, filterable, sortable fields)
	 */
	@Get(':entity/metadata')
	@ApiOperation({
		summary: 'Get complete entity metadata for dynamic UI builders',
		description: 'Returns complete metadata about searchable, filterable, and sortable fields with examples',
	})
	@ApiParam({
		name: 'entity',
		description: 'Entity name (countries, companies, regions, states)',
		example: 'countries',
	})
	@ApiResponse({
		status: 200,
		description: 'Entity metadata retrieved successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Entity not found',
	})
	getEntityMetadata(
		@Param('entity') entity: string,
		@Req() req: Request,
	): EntityMetadataResponse {
		const entityClass = this.validateAndGetEntity(entity);
		const baseUrl = this.getBaseUrl(req);
		return this.metadataService.getEntityMetadata(entityClass, entity.toLowerCase(), baseUrl);
	}

	/**
	 * GET /v1/:entity/metadata/search
	 * Searchable fields for entity
	 */
	@Get(':entity/metadata/search')
	@ApiOperation({
		summary: 'Get searchable fields for entity',
		description: 'Returns fields that can be used with the search query parameter',
	})
	@ApiParam({
		name: 'entity',
		description: 'Entity name',
		example: 'countries',
	})
	getSearchableFields(@Param('entity') entity: string) {
		const entityClass = this.validateAndGetEntity(entity);
		const fields = this.metadataService.getSearchableFields(entityClass);

		return {
			total: fields.length,
			fields,
			usage: {
				queryParam: 'search',
				example: '?search=United',
				description: 'Full-text search across all searchable fields. Supports partial matching for text and range queries for numbers.',
			},
		};
	}

	/**
	 * GET /v1/:entity/metadata/filters
	 * Filterable fields for entity
	 */
	@Get(':entity/metadata/filters')
	@ApiOperation({
		summary: 'Get filterable fields for entity',
		description: 'Returns fields that can be used with the filter query parameter',
	})
	@ApiParam({
		name: 'entity',
		description: 'Entity name',
		example: 'countries',
	})
	getFilterableFields(@Param('entity') entity: string) {
		const entityClass = this.validateAndGetEntity(entity);
		const fields = this.metadataService.getFilterableFields(entityClass);

		return {
			total: fields.length,
			fields,
			usage: {
				queryParam: 'filter',
				format: 'field:operator:value',
				example: '?filter=name:contains:United&filter=dialingCode:eq:1',
				operators: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in'],
				description: 'Filter results by field values. Multiple filters can be combined.',
			},
		};
	}

	/**
	 * GET /v1/:entity/metadata/sort
	 * Sortable fields for entity
	 */
	@Get(':entity/metadata/sort')
	@ApiOperation({
		summary: 'Get sortable fields for entity',
		description: 'Returns fields that can be used with the sort query parameter',
	})
	@ApiParam({
		name: 'entity',
		description: 'Entity name',
		example: 'countries',
	})
	getSortableFields(@Param('entity') entity: string) {
		const entityClass = this.validateAndGetEntity(entity);
		const fields = this.metadataService.getSortableFields(entityClass);

		return {
			total: fields.length,
			fields,
			usage: {
				queryParam: 'sort',
				format: 'field:direction',
				example: '?sort=name:ASC',
				directions: ['ASC', 'DESC'],
				description: 'Sort results by one or more fields. Multiple sorts: ?sort=name:ASC&sort=id:DESC',
			},
		};
	}

	// ========================================================================
	// HELPER METHODS
	// ========================================================================

	/**
	 * Validate entity exists and return entity class
	 */
	private validateAndGetEntity(entity: string): new () => any {
		const entityName = entity.toLowerCase();
		const entityClass = this.entityRegistry.get(entityName);

		if (!entityClass) {
			const available = this.entityRegistry.getNames();
			throw new NotFoundException({
				statusCode: 404,
				message: `Entity '${entity}' not found`,
				error: 'Not Found',
				availableEntities: available,
				hint: `Try one of: ${available.join(', ')}`,
			});
		}

		return entityClass;
	}

	/**
	 * Get base URL from request
	 */
	private getBaseUrl(request: Request): string {
		const protocol = request.protocol;
		const host = request.get('host');
		return `${protocol}://${host}/v1`;
	}
}
