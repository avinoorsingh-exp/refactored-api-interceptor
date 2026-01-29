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
import {
	CreateContactMethodInput,
	UpdateContactMethodInput,
	AgentIdParamSchema,
} from '@exprealty/shared-domain';
import { ZodValidationPipe } from '../../../common/zod-validation.pipe.js';
import { ContactMethodService } from './contact-method.service.js';
import {
	ContactMethodResponseDto,
	CreateContactMethodDto,
	UpdateContactMethodDto,
} from './dto/index.js';
import { PaginationInterceptor } from '../../../common/pagination/pagination.interceptor.js';
import { LoggerService } from '../../../core/logger.service.js';
import { AgentExistsGuard } from '../../../common/guards/agent-exists.guard.js';
import { Agent } from '../../../common/decorators/agent.decorator.js';
import type { Agent as AgentType } from '@exprealty/shared-domain';

/**
 * BigInt validation schema for contact method ID (legacy system uses numeric IDs).
 */
const ContactMethodIdSchema = z.string().regex(/^\d+$/, { message: 'errors.contactMethod.id.invalid' });

/**
 * Controller for Contact Method nested endpoints under Agent.
 * Routes: GET/POST/PUT /v1/agents/:id/contactmethods
 * 
 * Uses AgentExistsGuard to validate agent exists before processing.
 * The validated agent is available via @Agent() decorator.
 */
@ApiTags('agents')
@Controller('v1/agents/:id/contactmethods')
@UseGuards(AgentExistsGuard)
export class ContactMethodController {
	constructor(
		private readonly contactMethodService: ContactMethodService,
		private readonly logger: LoggerService,
	) {
		this.logger.setContext('ContactMethodController');
	}

	/**
	 * Lists contact methods for an agent with pagination.
	 * GET /v1/agents/:id/contactmethods
	 */
	@Get()
	@UseInterceptors(PaginationInterceptor)
	@ApiOperation({
		summary: 'List contact methods for an agent',
		description: 'Returns a paginated list of contact methods for the specified agent.',
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
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Pagination limit (max: 50, default: 25)',
	})
	@ApiResponse({
		status: 200,
		description: 'List of contact methods with pagination',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent not found',
	})
	async findAll(
		@Agent() agent: AgentType,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: ContactMethodResponseDto[]; total: number }> {
		const result = await this.contactMethodService.findByAgentId(agent.id, {
			offset: query.offset ?? 0,
			limit: query.limit ?? 25,
		});

		return {
			items: result.items as unknown as ContactMethodResponseDto[],
			total: result.total,
		};
	}

	/**
	 * Gets a specific contact method by ID.
	 * GET /v1/agents/:id/contactmethods/:contactMethodId
	 */
	@Get(':contactMethodId')
	@ApiOperation({
		summary: 'Get a contact method by ID',
		description: 'Returns a single contact method for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'contactMethodId',
		type: 'string',
		description: 'Contact method ID',
		example: '12345',
	})
	@ApiResponse({
		status: 200,
		description: 'Contact method found',
		type: ContactMethodResponseDto,
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or contact method not found',
	})
	async findById(
		@Agent() agent: AgentType,
		@Param('contactMethodId', new ZodValidationPipe(ContactMethodIdSchema, 'contactmethod.validation'))
		contactMethodId: string,
	): Promise<ContactMethodResponseDto> {
		return this.contactMethodService.findById(agent.id, contactMethodId) as unknown as Promise<ContactMethodResponseDto>;
	}

	/**
	 * Creates a new contact method for an agent.
	 * POST /v1/agents/:id/contactmethods
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a contact method',
		description: 'Creates a new contact method for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiBody({
		type: CreateContactMethodDto,
		description: 'Contact method data to create',
	})
	@ApiResponse({
		status: 201,
		description: 'Contact method created successfully',
		type: ContactMethodResponseDto,
		headers: {
			Location: {
				description: 'URL of the created contact method',
				schema: { type: 'string' },
			},
		},
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
		description: 'Conflict - duplicate name or primary already exists',
	})
	async create(
		@Agent() agent: AgentType,
		@Body(new ZodValidationPipe(CreateContactMethodInput, 'contactmethod.validation'))
		body: CreateContactMethodDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ContactMethodResponseDto> {
		this.logger.info(`Creating contact method for agent ${agent.id}`);

		const contactMethod = await this.contactMethodService.create(agent.id, body);

		res.setHeader('Location', `/v1/agents/${agent.id}/contactmethods/${contactMethod.id}`);

		return contactMethod as unknown as ContactMethodResponseDto;
	}

	/**
	 * Updates a contact method for an agent.
	 * PUT /v1/agents/:id/contactmethods/:contactMethodId
	 */
	@Put(':contactMethodId')
	@ApiOperation({
		summary: 'Update a contact method',
		description: 'Updates an existing contact method for the specified agent.',
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'Agent UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiParam({
		name: 'contactMethodId',
		type: 'string',
		description: 'Contact method ID',
		example: '12345',
	})
	@ApiBody({
		type: UpdateContactMethodDto,
		description: 'Contact method data to update',
	})
	@ApiResponse({
		status: 200,
		description: 'Contact method updated successfully',
		type: ContactMethodResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Validation error',
	})
	@ApiResponse({
		status: 404,
		description: 'Agent or contact method not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Conflict - duplicate name or primary already exists',
	})
	async update(
		@Agent() agent: AgentType,
		@Param('contactMethodId', new ZodValidationPipe(ContactMethodIdSchema, 'contactmethod.validation'))
		contactMethodId: string,
		@Body(new ZodValidationPipe(UpdateContactMethodInput, 'contactmethod.validation'))
		body: UpdateContactMethodDto,
	): Promise<ContactMethodResponseDto> {
		this.logger.info(`Updating contact method ${contactMethodId} for agent ${agent.id}`);

		return this.contactMethodService.update(agent.id, contactMethodId, body) as unknown as Promise<ContactMethodResponseDto>;
	}
}
