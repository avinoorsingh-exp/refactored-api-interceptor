import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema for sponsor assigned path parameters.
 * @public
 */
export const SponsorAssignedParamsSchema = z.object({
	applicantUuid: z.string().uuid('Invalid ApplicantUuid format'),
	sponsorUuid: z.string().uuid('Invalid SponsorUuid format'),
});

/**
 * TypeScript type for sponsor assigned path parameters.
 * @public
 */
export type SponsorAssignedParams = z.infer<typeof SponsorAssignedParamsSchema>;

/**
 * DTO for sponsor assigned path parameters.
 * Used for OpenAPI documentation.
 * @public
 */
export class SponsorAssignedParamsDto {
	@ApiProperty({
		description: 'UUID of the applicant agent',
		example: '550e8400-e29b-41d4-a716-446655440000',
		required: true,
		format: 'uuid',
	})
	applicantUuid!: string;

	@ApiProperty({
		description: 'UUID of the sponsor agent',
		example: '660e8400-e29b-41d4-a716-446655440001',
		required: true,
		format: 'uuid',
	})
	sponsorUuid!: string;
}

