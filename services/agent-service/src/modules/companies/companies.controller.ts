import {
	Controller,
	Get,
	Post,
	Put,
	Param,
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
	ApiParam,
	ApiBody,
} from '@nestjs/swagger'
import {
	CompanyIdParamSchema,
	CreateCompanyInputSchema,
	UpdateCompanyInputSchema,
} from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { CompaniesService } from './companies.service.js'
import { CompanyIdParamDto } from './dto/company-id-param.dto.js'
import { CreateCompanyDto } from './dto/create-company.dto.js'
import { UpdateCompanyInputDto } from './dto/update-company-input.dto.js'
import { CompanyResponseDto } from './dto/company-response.dto.js'

/**
 * Controller for Company entity endpoints.
 * Handles HTTP requests related to company operations.
 */
@ApiTags('companies')
@Controller('v1/companies')
export class CompaniesController {
	constructor(private readonly companiesService: CompaniesService) {}

	/**
	 * Creates a new company.
	 * POST /v1/companies
	 *
	 * @param body - Company data to create
	 * @param res - Express response object for setting Location header
	 * @returns The created company with 201 status
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new company',
		description: 'Creates a new company with a unique normalized name.',
	})
	@ApiBody({
		type: CreateCompanyDto,
		description: 'Company data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Company created successfully',
		type: CompanyResponseDto,
		headers: {
			Location: {
				description: 'URL of the created company',
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
				CreateCompanyInputSchema,
				'agent.company.validation',
			),
		)
		body: CreateCompanyDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<CompanyResponseDto> {
		const company = await this.companiesService.create(body as any)

		// Set Location header
		res.setHeader('Location', `/v1/companies/${company.id}`)

		return company as any
	}

	/**
	 * Retrieves a company by its UUID.
	 * GET /v1/companies/{id}
	 *
	 * @param params - Path parameters containing company ID
	 * @returns The company resource
	 */
	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Get a company by ID',
		description: 'Retrieves a company by its UUID.',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: String,
		format: 'uuid',
	})
	@ApiResponse({
		status: 200,
		description: 'Company retrieved successfully',
		type: CompanyResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - invalid UUID format',
	})
	@ApiResponse({
		status: 404,
		description: 'Company not found',
	})
	async findById(
		@Param(new ZodValidationPipe(CompanyIdParamSchema, 'agent.company.validation'))
		params: CompanyIdParamDto,
	): Promise<CompanyResponseDto> {
		return this.companiesService.findById(params.id) as any
	}

	/**
	 * Updates an existing company by ID.
	 * PUT /v1/companies/{id}
	 *
	 * @param params - Path parameters containing company ID
	 * @param body - Company data to update
	 * @returns The updated company
	 */
	@Put(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Update a company',
		description: 'Updates an existing company by its UUID. Requires all fields (full replacement).',
	})
	@ApiParam({
		name: 'id',
		description: 'Company UUID',
		type: String,
		format: 'uuid',
	})
	@ApiBody({
		type: UpdateCompanyInputDto,
		description: 'Company data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Company updated successfully',
		type: CompanyResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error - malformed or invalid data',
	})
	@ApiResponse({
		status: 404,
		description: 'Company not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name or email',
	})
	async update(
		@Param(new ZodValidationPipe(CompanyIdParamSchema, 'agent.company.validation'))
		params: CompanyIdParamDto,
		@Body(new ZodValidationPipe(UpdateCompanyInputSchema, 'agent.company.validation'))
		body: UpdateCompanyInputDto,
	): Promise<CompanyResponseDto> {
		return this.companiesService.update(params.id, body as any)
	}
}
