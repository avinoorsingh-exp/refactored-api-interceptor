import {
	Controller,
	Put,
	Param,
	Body,
	HttpCode,
	HttpStatus,
} from '@nestjs/common'
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBody,
} from '@nestjs/swagger'
import {
	CompanyIdParamSchema,
	UpdateCompanyInputSchema,
} from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { CompaniesService } from './companies.service.js'
import { CompanyIdParamDto } from './dto/company-id-param.dto.js'
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
