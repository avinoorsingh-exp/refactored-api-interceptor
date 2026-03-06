import { Test, TestingModule } from '@nestjs/testing';
import { KafkaMessageProcessingController } from './kafka-message-processing.controller.js';
import { KafkaMessageProcessingService } from './kafka-message-processing.service.js';
import { PaginationService } from '../../common/pagination/pagination.service.js';
import { KafkaMessageStatus } from '@exprealty/database';
import { Request, Response } from 'express';

describe('KafkaMessageProcessingController', () => {
	let controller: KafkaMessageProcessingController;
	let mockService: jest.Mocked<KafkaMessageProcessingService>;
	let mockPaginationService: jest.Mocked<PaginationService>;
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;

	beforeEach(async () => {
		mockService = {
			findPage: jest.fn(),
			findById: jest.fn(),
			retryMessage: jest.fn(),
			mapEntityToDto: jest.fn(),
		} as any;

		mockPaginationService = {
			normalize: jest.fn(),
			createMeta: jest.fn(),
		} as any;

		mockRequest = {
			headers: { 'x-correlation-id': 'test-correlation-id' },
			path: '/v1/kafka/messages',
			query: {},
		};

		mockResponse = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [KafkaMessageProcessingController],
			providers: [
				{
					provide: KafkaMessageProcessingService,
					useValue: mockService,
				},
				{
					provide: PaginationService,
					useValue: mockPaginationService,
				},
			],
		}).compile();

		controller = module.get<KafkaMessageProcessingController>(KafkaMessageProcessingController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('findOne', () => {
		const messageId = '550e8400-e29b-41d4-a716-446655440000';

		it('should return message DTO when found', async () => {
			// Arrange
			const mockMessage = {
				id: messageId,
				topic: 'test-topic',
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 1,
			};

			const mockDto = {
				id: messageId,
				topic: 'test-topic',
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 1,
			};

			mockService.findById.mockResolvedValue(mockMessage as any);
			mockService.mapEntityToDto.mockReturnValue(mockDto as any);

			// Act
			const result = await controller.findOne(messageId, mockRequest as Request);

			// Assert
			expect(mockService.findById).toHaveBeenCalledWith(messageId);
			expect(mockService.mapEntityToDto).toHaveBeenCalledWith(mockMessage);
			expect(result).toEqual(mockDto);
		});

		it('should throw NotFoundException when message not found', async () => {
			// Arrange
			mockService.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(controller.findOne(messageId, mockRequest as Request)).rejects.toThrow();
			expect(mockService.findById).toHaveBeenCalledWith(messageId);
		});
	});

	describe('retryMessage', () => {
		const messageId = '550e8400-e29b-41d4-a716-446655440000';

		it('should retry message without custom payload', async () => {
			// Arrange
			const mockResult = {
				id: messageId,
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 2,
			};

			mockService.retryMessage.mockResolvedValue(mockResult as any);
			mockRequest.body = undefined;

			// Act
			await controller.retryMessage(
				messageId,
				mockRequest as Request,
				mockResponse as Response,
			);

			// Assert
			expect(mockService.retryMessage).toHaveBeenCalledWith(messageId, undefined);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
		});

		it('should retry message with custom payload in body', async () => {
			// Arrange
			const customPayload = { agent: { id: 'test-id', firstName: 'John' } };
			const mockResult = {
				id: messageId,
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 2,
			};

			mockService.retryMessage.mockResolvedValue(mockResult as any);
			mockRequest.body = customPayload;

			// Act
			await controller.retryMessage(
				messageId,
				mockRequest as Request,
				mockResponse as Response,
			);

			// Assert
			expect(mockService.retryMessage).toHaveBeenCalledWith(messageId, customPayload);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
		});

		it('should retry message with payload property in body', async () => {
			// Arrange
			const customPayload = { agent: { id: 'test-id', firstName: 'John' } };
			const bodyWithPayload = { payload: customPayload };
			const mockResult = {
				id: messageId,
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 2,
			};

			mockService.retryMessage.mockResolvedValue(mockResult as any);
			mockRequest.body = bodyWithPayload;

			// Act
			await controller.retryMessage(
				messageId,
				mockRequest as Request,
				mockResponse as Response,
			);

			// Assert
			expect(mockService.retryMessage).toHaveBeenCalledWith(messageId, customPayload);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
		});

		it('should ignore empty payload object', async () => {
			// Arrange
			const mockResult = {
				id: messageId,
				status: KafkaMessageStatus.PROCESSED,
				attemptCount: 2,
			};

			mockService.retryMessage.mockResolvedValue(mockResult as any);
			mockRequest.body = {}; // Empty object

			// Act
			await controller.retryMessage(
				messageId,
				mockRequest as Request,
				mockResponse as Response,
			);

			// Assert
			expect(mockService.retryMessage).toHaveBeenCalledWith(messageId, undefined);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
		});

		it('should handle service errors and let ProblemDetailsFilter handle them', async () => {
			// Arrange
			const error = new Error('Service error');
			mockService.retryMessage.mockRejectedValue(error);
			mockRequest.body = undefined;

			// Act & Assert
			await expect(
				controller.retryMessage(
					messageId,
					mockRequest as Request,
					mockResponse as Response,
				),
			).rejects.toThrow('Service error');
			expect(mockService.retryMessage).toHaveBeenCalledWith(messageId, undefined);
		});
	});
});

