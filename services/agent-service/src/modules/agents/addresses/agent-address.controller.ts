import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	Res,
	UseInterceptors,
	UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBody,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CreateAgentAddressInput, UpdateAgentAddressInput, CreateAddressInput, AddressIdSchema } from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { AgentAddressService } from './agent-address.service.js';
import {
	AgentAddressResponseDto,
	CreateAgentAddressDto,
	UpdateAgentAddressDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { Agent } from '../../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';


/**
 * Address ID validation schema (BigInt as string).
 * Validates that the string represents a valid numeric BigInt.
 */

/**
 * Zod schema for creating an agent address with inline address creation.
 * Extends CreateAddressInput (which uses trimmed validators) with isPrimary junction metadata.
 * Address string fields (line1, line2, city, unit, postalCode, county, label) are trimmed.
 */
const CreateAgentAddressSchema = CreateAddressInput.extend({
	isPrimary: z.boolean(),
});

/**
 * Zod schema for updating an agent address.
 */
const UpdateAgentAddressSchema = CreateAgentAddressSchema.partial();

/**
 * Controller for Agent Address nested endpoints.
 * Routes: GET/POST/PUT/DELETE /v1/agents/:id/addresses
 * 
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('agents')
@Controller('v1/agents/:id/addresses')
@UseGuards(AgentExistsGuard)
export class AgentAddressController {
	constructor(
		private readonly agentAddressService: AgentAddressService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('AgentAddressController');
	}

	/**
	 * Lists addresses for an agent with pagination.
	 * GET /v1/agents/:id/addresses
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List addresses for an agent',
		description: 'Returns a paginated list of addresses for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiQuery({
		name: 'offset',
		required: false,
		type: Number,
		description: 'Pagination offset (default: 0)',
		example: 0,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Pagination limit (max: 50, default: 25)',
		example: 25,
	})
	@ApiResponse({
		status: 200,
		description: 'List of addresses with pagination',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: AgentAddressResponseDto[]; total: number }> {
		const result = await this.agentAddressService.findByAgentId(agent.id, {
			offset: query.offset ?? 0,
			limit: query.limit ?? 25,
		});

		return {
			items: result.items as unknown as AgentAddressResponseDto[],
			total: result.total,
		};
	}

	/**
	 * Gets a specific address by ID.
	 * GET /v1/agents/:id/addresses/:addressId
	 */
	@Get(':addressId')
	@ApiOperation({
		summary: 'Get an address by ID',
		description: 'Returns a single address for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'addressId',
		type: 'string',
		description: 'Address ID (BigInt as string)',
		example: '12345',
	})
	@ApiResponse({
		status: 200,
		description: 'Address found',
		type: AgentAddressResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid address ID format',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or address not found',
	})
	async findById(
		@Agent() agent: AgentType,
		@Param('addressId', new ZodValidationPipe(AddressIdSchema, 'address.validation'))
		addressId: string,
	): Promise<AgentAddressResponseDto> {
		const address = await this.agentAddressService.findByCompositeKey(agent.id, addressId);
		return address as unknown as AgentAddressResponseDto;
	}

	/**
	 * Creates a new address for an agent.
	 * POST /v1/agents/:id/addresses
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new address for an agent',
		description: 'Creates a new address and links it to the agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiBody({ type: CreateAgentAddressDto })
	@ApiResponse({
		status: 201,
		description: 'Address created successfully',
		type: AgentAddressResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Primary address already exists',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(new ZodValidationPipe(CreateAgentAddressSchema, 'agentaddress.validation'))
		body: CreateAgentAddressDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<AgentAddressResponseDto> {
		const address = await this.agentAddressService.create(agent.id, body);

		res.setHeader('Location', `/v1/agents/${agent.id}/addresses/${address.addressId}`);

		return address as unknown as AgentAddressResponseDto;
	}

	/**
	 * Updates an existing address for an agent.
	 * PUT /v1/agents/:id/addresses/:addressId
	 */
	@Put(':addressId')
	@ApiOperation({
		summary: 'Update an address for an agent',
		description: 'Updates an existing address and its link metadata.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'addressId',
		type: 'string',
		description: 'Address ID (BigInt as string)',
		example: '12345',
	})
	@ApiBody({ type: UpdateAgentAddressDto })
	@ApiResponse({
		status: 200,
		description: 'Address updated successfully',
		type: AgentAddressResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or address not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Primary address already exists',
	})
	async update(
		@Agent() agent: AgentType,
		@Param('addressId', new ZodValidationPipe(AddressIdSchema, 'address.validation'))
		addressId: string,
		@Body(new ZodValidationPipe(UpdateAgentAddressSchema, 'agentaddress.validation'))
		body: UpdateAgentAddressDto,
	): Promise<AgentAddressResponseDto> {
		const address = await this.agentAddressService.update(agent.id, addressId, body);
		return address as unknown as AgentAddressResponseDto;
	}

	/**
	 * Deletes an address for an agent.
	 * DELETE /v1/agents/:id/addresses/:addressId
	 */
	@Delete(':addressId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete an address for an agent',
		description: 'Removes an address link from the agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'addressId',
		type: 'string',
		description: 'Address ID (BigInt as string)',
		example: '12345',
	})
	@ApiResponse({
		status: 204,
		description: 'Address deleted successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or address not found',
	})
	async delete(
		@Agent() agent: AgentType,
		@Param('addressId', new ZodValidationPipe(AddressIdSchema, 'address.validation'))
		addressId: string,
	): Promise<void> {
		await this.agentAddressService.delete(agent.id, addressId);
	}
}
