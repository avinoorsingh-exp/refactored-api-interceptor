import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
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
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(
		private schema: ZodTypeAny,
		private i18nType?: string,
	) {}

	transform(value: unknown) {
		const parsed = this.schema.safeParse(value, { errorMap: validationErrorMap })
		if (!parsed.success) {
			// Pass Zod error issues directly for better invalidParams extraction
			const errorResponse: Record<string, unknown> = {
				_zodIssues: parsed.error.issues,
			}
			if (this.i18nType) {
				errorResponse._i18nType = this.i18nType
			}
			throw new BadRequestException(errorResponse)
		}
		return parsed.data
	}
}
