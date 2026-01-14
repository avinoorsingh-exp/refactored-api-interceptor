import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema for sponsor changed request payload.
 * @public
 */
export const SponsorChangedRequestSchema = z.object({
	ApplicantUuid: z.string().uuid('Invalid ApplicantUuid format'),
	SponsorUuid: z.string().uuid('Invalid SponsorUuid format'),
});

/**
 * TypeScript type for sponsor changed request.
 * @public
 */
export type SponsorChangedRequest = z.infer<typeof SponsorChangedRequestSchema>;

/**
 * DTO for sponsor changed request.
 * Used for OpenAPI documentation.
 * @public
 */
export class SponsorChangedRequestDto {
	@ApiProperty({
		description: 'UUID of the applicant agent',
		example: '550e8400-e29b-41d4-a716-446655440000',
		required: true,
		format: 'uuid',
	})
	ApplicantUuid!: string;

	@ApiProperty({
		description: 'UUID of the sponsor agent',
		example: '660e8400-e29b-41d4-a716-446655440001',
		required: true,
		format: 'uuid',
	})
	SponsorUuid!: string;
}

