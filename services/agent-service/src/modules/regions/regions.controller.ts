import {
	Controller,
	Post,
	Body,
	HttpCode,
	HttpStatus,
	Res,
} from '@nestjs/common'
import { Response } from 'express'
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
} from '@nestjs/swagger'
import { CreateRegionInputSchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { RegionsService } from './regions.service.js'
import { CreateRegionDto } from './dto/create-region.dto.js'
import { RegionResponseDto } from './dto/region-response.dto.js'

/**
 * Controller for Region entity endpoints.
 * Handles HTTP requests related to region operations.
 */
@ApiTags('regions')
@Controller('v1/regions')
export class RegionsController {
	constructor(private readonly regionsService: RegionsService) {}

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
}
