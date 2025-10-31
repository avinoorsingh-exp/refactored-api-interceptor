import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { ZodTypeAny } from 'zod'

/**
 * Validation pipe that uses Zod schemas for request body validation.
 * Transforms validation errors into BadRequestException which is then
 * converted to RFC 9457 Problem Details by ProblemDetailsFilter.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(private schema: ZodTypeAny) {}

	transform(value: unknown) {
		const parsed = this.schema.safeParse(value)
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.format())
		}
		return parsed.data
	}
}
