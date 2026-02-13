import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SponsorChangedController } from './sponsor-changed.controller.js';
import { SponsorChangedService } from './sponsor-changed.service.js';
import { Request } from 'express';

describe('SponsorChangedController', () => {
	let controller: SponsorChangedController;
	let mockSponsorChangedService: jest.Mocked<SponsorChangedService>;
	let mockRequest: Partial<Request>;

	beforeEach(async () => {
		mockSponsorChangedService = {
			processSponsorChanged: jest.fn().mockResolvedValue(undefined),
			processSponsorWriteIn: jest.fn().mockResolvedValue(undefined),
		} as any;

		mockRequest = {
			headers: {
				'x-correlation-id': 'test-correlation-id',
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SponsorChangedController],
			providers: [
				{
					provide: SponsorChangedService,
					useValue: mockSponsorChangedService,
				},
			],
		}).compile();

		controller = module.get<SponsorChangedController>(SponsorChangedController);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('sponsorChanged', () => {
		const applicantUuid = '550e8400-e29b-41d4-a716-446655440000';
		const sponsorUuid = '2b43a5dc-21c5-4925-97bc-53ea4ab0ed04';

		it('should process sponsor changed event successfully', async () => {
			const result = await controller.sponsorChanged(
				{
					applicantUuid,
					sponsorUuid,
				},
				undefined, // type query - defaults to 'applicant'
				mockRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorChanged).toHaveBeenCalledWith(
				applicantUuid,
				sponsorUuid,
				'applicant',
			);
			expect(result).toEqual({
				message: 'Sponsor changed message sent successfully',
			});
		});

		it('should throw HttpException when service throws error', async () => {
			const error = new HttpException('Sponsor not found', HttpStatus.NOT_FOUND);
			mockSponsorChangedService.processSponsorChanged.mockRejectedValue(error);

			await expect(
				controller.sponsorChanged(
					{
						applicantUuid,
						sponsorUuid,
					},
					undefined,
					mockRequest as Request,
				),
			).rejects.toThrow(error);
		});

		it('should pass type=agent when query type is agent', async () => {
			await controller.sponsorChanged(
				{ applicantUuid, sponsorUuid },
				'agent',
				mockRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorChanged).toHaveBeenCalledWith(
				applicantUuid,
				sponsorUuid,
				'agent',
			);
		});
	});

	describe('sponsorWriteIn', () => {
		const applicantUuid = '550e8400-e29b-41d4-a716-446655440000';
		const sponsorName = 'John Doe';

		it('should process sponsor write-in event successfully', async () => {
			const result = await controller.sponsorWriteIn(
				applicantUuid,
				undefined, // type query - defaults to 'applicant'
				{ name: sponsorName },
				mockRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorWriteIn).toHaveBeenCalledWith(
				applicantUuid,
				sponsorName,
				'applicant',
			);
			expect(result).toEqual({
				message: 'Sponsor write-in message sent successfully',
			});
		});

		it('should handle sponsor name with spaces', async () => {
			const sponsorNameWithSpaces = 'John Michael Doe';
			const result = await controller.sponsorWriteIn(
				applicantUuid,
				undefined,
				{ name: sponsorNameWithSpaces },
				mockRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorWriteIn).toHaveBeenCalledWith(
				applicantUuid,
				sponsorNameWithSpaces,
				'applicant',
			);
			expect(result).toEqual({
				message: 'Sponsor write-in message sent successfully',
			});
		});

		it('should throw HttpException for invalid UUID format', async () => {
			const invalidUuid = 'invalid-uuid';

			await expect(
				controller.sponsorWriteIn(
					invalidUuid,
					undefined,
					{ name: sponsorName },
					mockRequest as Request,
				),
			).rejects.toThrow(HttpException);

			expect(mockSponsorChangedService.processSponsorWriteIn).not.toHaveBeenCalled();
		});

		it('should throw HttpException when service throws error', async () => {
			const error = new Error('Kafka send failed');
			mockSponsorChangedService.processSponsorWriteIn.mockRejectedValue(error);

			await expect(
				controller.sponsorWriteIn(
					applicantUuid,
					undefined,
					{ name: sponsorName },
					mockRequest as Request,
				),
			).rejects.toThrow(error);
		});

		it('should use correlation ID from request headers', async () => {
			const customCorrelationId = 'custom-correlation-id';
			const customRequest = {
				headers: {
					'x-correlation-id': customCorrelationId,
				},
			};

			await controller.sponsorWriteIn(
				applicantUuid,
				undefined,
				{ name: sponsorName },
				customRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorWriteIn).toHaveBeenCalled();
		});

		it('should use "unknown" correlation ID when header is missing', async () => {
			const requestWithoutCorrelationId = {
				headers: {},
			};

			await controller.sponsorWriteIn(
				applicantUuid,
				undefined,
				{ name: sponsorName },
				requestWithoutCorrelationId as Request,
			);

			expect(mockSponsorChangedService.processSponsorWriteIn).toHaveBeenCalled();
		});

		it('should pass type=agent when query type is agent', async () => {
			await controller.sponsorWriteIn(
				applicantUuid,
				'agent',
				{ name: sponsorName },
				mockRequest as Request,
			);

			expect(mockSponsorChangedService.processSponsorWriteIn).toHaveBeenCalledWith(
				applicantUuid,
				sponsorName,
				'agent',
			);
		});
	});
});

