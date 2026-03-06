import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema for sponsor write-in request body.
 * @public
 */
export const SponsorWriteInRequestSchema = z.object({
	name: z.string().min(1, 'Name is required').max(500, 'Name must be less than 500 characters'),
});

/**
 * TypeScript type for sponsor write-in request body.
 * @public
 */
export type SponsorWriteInRequest = z.infer<typeof SponsorWriteInRequestSchema>;

/**
 * DTO for sponsor write-in request body.
 * Used for OpenAPI documentation.
 * @public
 */
export class SponsorWriteInRequestDto {
	@ApiProperty({
		description: 'Sponsor name (write-in text value, may contain spaces)',
		example: 'John Doe',
		required: true,
		minLength: 1,
		maxLength: 500,
	})
	name!: string;
}

