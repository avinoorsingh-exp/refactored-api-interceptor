import {
	Controller,
	Get,
	Post,
	Put,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	Res,
	Req,
	UseInterceptors,
} from '@nestjs/common'
import { Request, Response } from 'express'
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger'
import { CreateRegionInputSchema, UpdateRegionInputSchema, RegionIdParamSchema, PaginationQuerySchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { RegionsService } from './regions.service.js'
import { PaginationService } from '../../common/pagination/pagination.service.js'
import { CreateRegionDto } from './dto/create-region.dto.js'
import { UpdateRegionDto } from './dto/update-region.dto.js'
import { RegionIdParamDto } from './dto/region-id-param.dto.js'
import { RegionResponseDto } from './dto/region-response.dto.js'
import { PaginationQueryDto } from '../../common/pagination/pagination.dto.js'
import { PaginationInterceptor } from '../../common/pagination/pagination.interceptor.js'

/**
 * Controller for Region entity endpoints.
 * Handles HTTP requests related to region operations.
 */
@ApiTags('regions')
@Controller('v1/regions')
export class RegionsController {
	constructor(
		private readonly regionsService: RegionsService,
		private readonly paginationService: PaginationService,
	) {}

	/**
	 * Creates a new region.
	 * POST /v1/regions
	 *
	 * @param body - Region data to create
	 * @param res - Express response object for setting Location header
	 * @returns The created region with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new region',
		description: 'Creates a new region with a unique normalized name.',
	})
	@ApiBody({
		type: CreateRegionDto,
		description: 'Region data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Region created successfully',
		type: RegionResponseDto,
		headers: {
			Location: {
				description: 'URL of the created region',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate normalized name',
	})
	async create(
		@Body(
			new ZodValidationPipe(
				CreateRegionInputSchema,
				'agent.region.validation',
			),
		)
		body: CreateRegionDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<RegionResponseDto> {
		const region = await this.regionsService.create(body as any)

		// Set Location header
		res.setHeader('Location', `/v1/regions/${region.id}`)

		return region as any
	}

	/**
	 * Retrieves a paginated list of regions.
	 * GET /v1/regions?offset={n}&limit={m}
	 *
	 * @param query - Pagination query parameters (offset, limit)
	 * @param req - Express request object for building Link header
	 * @param res - Express response object for setting headers
	 * @returns Array of regions with pagination headers
	 */
	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'List regions with pagination',
		description: 'Retrieves a paginated list of regions sorted by name (ascending). Returns X-Total-Count and Link headers for pagination.',
	})
	@ApiQuery({
		name: 'offset',
		description: 'Number of records to skip',
		required: false,
		type: Number,
		example: 0,
	})
	@ApiQuery({
		name: 'limit',
		description: 'Maximum number of records to return (max 50)',
		required: false,
		type: Number,
		example: 25,
	})
	@ApiResponse({
		status: 200,
		description: 'Regions retrieved successfully',
		type: [RegionResponseDto],
		headers: {
			'X-Total-Count': {
				description: 'Total number of regions',
				schema: { type: 'string' },
			},
			'Link': {
				description: 'RFC 8288 pagination links (rel=next, rel=prev, rel=first, rel=last)',
				schema: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - invalid offset or limit',
	})
	@UseInterceptors(PaginationInterceptor)
	async findAll(
		@Query() query: PaginationQueryDto,
	): Promise<{ items: RegionResponseDto[]; total: number }> {
		// The interceptor will handle pagination normalization and header setting
		// Just return the data in the expected format
		const { regions, total } = await this.regionsService.findPage(query as any)

		// Map domain Region to RegionResponseDto with snake_case timestamps
		const items = regions.map(r => ({
			id: r.id,
			name: r.name,
			created_at: r.createdAt.toISOString(),
			updated_at: r.updatedAt.toISOString(),
		}))

		return { items, total }
	}

	/**
	 * Retrieves a region by its UUID.
	 * GET /v1/regions/{id}
	 *
	 * @param params - Path parameters containing region ID
	 * @returns The region resource
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get a region by ID',
		description: 'Retrieves a region by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Region UUID',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Region retrieved successfully',
		type: RegionResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - invalid UUID format',
	})
	@ApiResponse({
		status: 404,
		description: 'Region not found',
	})
	async findById(
		@Param(new ZodValidationPipe(RegionIdParamSchema, 'agent.region.validation'))
		params: RegionIdParamDto,
	): Promise<RegionResponseDto> {
		return this.regionsService.findById(params.id) as any
	}

	/**
	 * Updates an existing region by ID.
	 * PUT /v1/regions/:id
	 *
	 * @param id - Region ID to update
	 * @param body - Region data to update
	 * @returns The updated region with 200 status
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update a region by ID',
		description: 'Updates an existing region. Returns 404 if not found, 409 if name conflicts.',
	})
	@ApiParam({
		name: 'id',
		description: 'Region ID',
		type: 'string',
	})
	@ApiBody({
		type: UpdateRegionDto,
		description: 'Region data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Region updated successfully',
		type: RegionResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Not found - region with given ID does not exist',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate normalized name',
	})
	async update(
		@Param('id') id: string,
		@Body(
			new ZodValidationPipe(
				UpdateRegionInputSchema,
				'agent.region.validation',
			),
		)
		body: UpdateRegionDto,
	): Promise<RegionResponseDto> {
		const region = await this.regionsService.update(id, body as any)
		return region as any
	}
}
