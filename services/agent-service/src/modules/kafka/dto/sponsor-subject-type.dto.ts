import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Schema for sponsor-assigned subject type query parameter.
 * Determines whether the payload uses ApplicantUuid or AgentUuid.
 * @public
 */
export const SponsorSubjectTypeSchema = z.enum(['applicant', 'agent']);

/**
 * TypeScript type for sponsor subject type.
 * @public
 */
export type SponsorSubjectType = z.infer<typeof SponsorSubjectTypeSchema>;

/** Default when type query is omitted (backward compatibility). */
export const SPONSOR_SUBJECT_TYPE_DEFAULT: SponsorSubjectType = 'applicant';

/**
 * Parses and validates the type query parameter.
 * Returns default when missing or invalid.
 *
 * @param value - Raw query value (string or undefined)
 * @returns 'applicant' | 'agent'
 */
export function parseSponsorSubjectType(value: string | undefined): SponsorSubjectType {
	if (value === undefined || value === '') {
		return SPONSOR_SUBJECT_TYPE_DEFAULT;
	}
	const parsed = SponsorSubjectTypeSchema.safeParse(value.toLowerCase());
	return parsed.success ? parsed.data : SPONSOR_SUBJECT_TYPE_DEFAULT;
}

/**
 * DTO for OpenAPI documentation of the type query parameter.
 * @public
 */
export class SponsorSubjectTypeQueryDto {
	@ApiPropertyOptional({
		description: 'Subject type: "applicant" (payload uses ApplicantUuid) or "agent" (payload uses AgentUuid). Defaults to "applicant".',
		enum: ['applicant', 'agent'],
		default: 'applicant',
	})
	type?: SponsorSubjectType;
}
