import { PipeTransform, Injectable, BadRequestException, ArgumentMetadata } from '@nestjs/common'
import { ZodTypeAny } from 'zod'
import { validationErrorMap } from '@exprealty/shared-domain'

/**
 * Validation pipe that uses Zod schemas for request body validation.
 * Transforms validation errors into BadRequestException which is then
 * converted to RFC 9457 Problem Details by ProblemDetailsFilter.
 * 
 * Uses global validationErrorMap to ensure all error messages are i18n codes.
 * 
 * Supports i18n-compatible error types by accepting an optional i18nType parameter.
 * Example: new ZodValidationPipe(CreateCountryInputSchema, 'agent.country.validation')
 * 
 * Empty payload detection:
 * - Rejects empty objects {} for request body validation
 * - Prevents no-op updates that return 200 OK without changes
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(
		private schema: ZodTypeAny,
		private i18nType?: string,
	) {}

	transform(value: unknown, metadata: ArgumentMetadata) {
		// Reject empty objects for body validation (prevents no-op updates)
		if (metadata.type === 'body' && this.isEmptyObject(value)) {
			const errorResponse: Record<string, unknown> = {
				message: 'Request body cannot be empty',
				_zodIssues: [{
					code: 'custom',
					path: [],
					message: 'At least one field must be provided',
				}],
			}
			if (this.i18nType) {
				errorResponse._i18nType = this.i18nType
			}
			throw new BadRequestException(errorResponse)
		}

		const parsed = this.schema.safeParse(value, { errorMap: validationErrorMap })
		if (!parsed.success) {
			// Ensure all issues have messages - map issues to include message if missing
			const issuesWithMessages = parsed.error.issues.map((issue) => ({
				...issue,
				message: issue.message || 
					(issue.code ? `Validation failed for ${issue.code}` : 'Validation failed') ||
					'Invalid value',
			}));
			
			// Pass Zod error issues directly for better invalidParams extraction
			const errorResponse: Record<string, unknown> = {
				_zodIssues: issuesWithMessages,
			}
			if (this.i18nType) {
				errorResponse._i18nType = this.i18nType
			}
			throw new BadRequestException(errorResponse)
		}
		return parsed.data
	}

	/**
	 * Checks if value is an empty object {}.
	 * Returns false for null, undefined, arrays, or objects with properties.
	 */
	private isEmptyObject(value: unknown): boolean {
		return (
			value !== null &&
			value !== undefined &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			Object.keys(value).length === 0
		)
	}
}
