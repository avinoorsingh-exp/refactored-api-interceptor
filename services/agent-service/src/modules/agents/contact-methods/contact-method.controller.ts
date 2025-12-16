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

/**
 * UUID validation schema for contact method ID.
 */
const ContactMethodIdSchema = z.string().uuid({ message: 'errors.contactMethod.id.invalid' });

/**
 * Controller for Contact Method nested endpoints under Agent.
 * Routes: GET/POST/PUT /v1/agents/:id/contactmethods
 */
@ApiTags('agents')
@Controller('v1/agents/:id/contactmethods')
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
		@Param('id', new ZodValidationPipe(AgentIdParamSchema.shape.id, 'agent.validation'))
		agentId: string,
		@Query() query: { offset?: number; limit?: number },
	): Promise<{ items: ContactMethodResponseDto[]; total: number }> {
		const result = await this.contactMethodService.findByAgentId(agentId, {
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
		description: 'Contact method UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
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
		@Param('id', new ZodValidationPipe(AgentIdParamSchema.shape.id, 'agent.validation'))
		agentId: string,
		@Param('contactMethodId', new ZodValidationPipe(ContactMethodIdSchema, 'contactmethod.validation'))
		contactMethodId: string,
	): Promise<ContactMethodResponseDto> {
		return this.contactMethodService.findById(agentId, contactMethodId) as unknown as Promise<ContactMethodResponseDto>;
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
		description: 'Conflict - duplicate name',
	})
	async create(
		@Param('id', new ZodValidationPipe(AgentIdParamSchema.shape.id, 'agent.validation'))
		agentId: string,
		@Body(new ZodValidationPipe(CreateContactMethodInput, 'contactmethod.validation'))
		body: CreateContactMethodDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ContactMethodResponseDto> {
		this.logger.info(`Creating contact method for agent ${agentId}`);

		const contactMethod = await this.contactMethodService.create(agentId, body);

		res.setHeader('Location', `/v1/agents/${agentId}/contactmethods/${contactMethod.id}`);

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
		description: 'Contact method UUID',
		example: '123e4567-e89b-12d3-a456-426614174000',
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
		description: 'Conflict - duplicate name',
	})
	async update(
		@Param('id', new ZodValidationPipe(AgentIdParamSchema.shape.id, 'agent.validation'))
		agentId: string,
		@Param('contactMethodId', new ZodValidationPipe(ContactMethodIdSchema, 'contactmethod.validation'))
		contactMethodId: string,
		@Body(new ZodValidationPipe(UpdateContactMethodInput, 'contactmethod.validation'))
		body: UpdateContactMethodDto,
	): Promise<ContactMethodResponseDto> {
		this.logger.info(`Updating contact method ${contactMethodId} for agent ${agentId}`);

		return this.contactMethodService.update(agentId, contactMethodId, body) as unknown as Promise<ContactMethodResponseDto>;
	}
}
