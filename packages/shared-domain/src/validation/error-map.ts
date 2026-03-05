import { z } from 'zod'

/**
 * Global Zod error map that transforms default validation errors into i18n codes.
 * 
 * This ensures consistent, machine-readable error codes for all validation failures
 * that can be localized on the frontend.
 * 
 * Pattern: errors.validation.{category}.{specific}
 * 
 * @example
 * // Default Zod: "Expected number, received string"
 * // With errorMap: "errors.validation.type.expected_number"
 * 
 * @example
 * // Default Zod: "Required"
 * // With errorMap: "errors.validation.required"
 * 
 * @public
 */
export const validationErrorMap: z.ZodErrorMap = (issue, ctx) => {
	// Handle different Zod issue types
	switch (issue.code) {
		case z.ZodIssueCode.invalid_type:
			if (issue.received === 'undefined') {
				return { message: 'errors.validation.required' }
			}
			// Map type mismatches to structured codes
			return {
				message: `errors.validation.type.expected_${issue.expected}`,
			}

		case z.ZodIssueCode.invalid_string:
			if (issue.validation === 'email') {
				return { message: 'errors.validation.string.invalid_email' }
			}
			if (issue.validation === 'url') {
				return { message: 'errors.validation.string.invalid_url' }
			}
			if (issue.validation === 'uuid') {
				return { message: 'errors.validation.string.invalid_uuid' }
			}
			if (issue.validation === 'regex') {
				return { message: 'errors.validation.string.invalid_format' }
			}
			return { message: 'errors.validation.string.invalid' }

		case z.ZodIssueCode.too_small:
			if (issue.type === 'string') {
				if (issue.minimum === 1) {
					return { message: 'errors.validation.required' }
				}
				return { message: 'errors.validation.string.min_length' }
			}
			if (issue.type === 'number') {
				return { message: 'errors.validation.number.too_small' }
			}
			if (issue.type === 'array') {
				return { message: 'errors.validation.array.min_items' }
			}
			return { message: 'errors.validation.too_small' }

		case z.ZodIssueCode.too_big:
			if (issue.type === 'string') {
				return { message: 'errors.validation.string.max_length' }
			}
			if (issue.type === 'number') {
				return { message: 'errors.validation.number.too_large' }
			}
			if (issue.type === 'array') {
				return { message: 'errors.validation.array.max_items' }
			}
			return { message: 'errors.validation.too_big' }

		case z.ZodIssueCode.invalid_enum_value:
			return { message: 'errors.validation.invalid_enum' }

		case z.ZodIssueCode.invalid_date:
			return { message: 'errors.validation.invalid_date' }

		case z.ZodIssueCode.invalid_literal:
			return { message: 'errors.validation.invalid_literal' }

		case z.ZodIssueCode.unrecognized_keys:
			return { message: 'errors.validation.unrecognized_keys' }

		case z.ZodIssueCode.invalid_union:
			return { message: 'errors.validation.invalid_union' }

		case z.ZodIssueCode.invalid_arguments:
			return { message: 'errors.validation.invalid_arguments' }

		case z.ZodIssueCode.invalid_return_type:
			return { message: 'errors.validation.invalid_return_type' }

		case z.ZodIssueCode.custom:
			// Custom errors can provide their own message
			return { message: issue.message || 'errors.validation.custom' }

		case z.ZodIssueCode.not_multiple_of:
			return { message: 'errors.validation.number.not_multiple_of' }

		case z.ZodIssueCode.not_finite:
			return { message: 'errors.validation.number.not_finite' }

		default:
			// Fallback for unknown issue codes
			return { message: ctx.defaultError }
	}
}
