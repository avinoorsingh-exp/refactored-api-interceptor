import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Country as CountryType } from '@exprealty/shared-domain'

/**
 * Country Decorator
 *
 * Retrieves validated country from request.
 * Must be used with CountryExistsGuard.
 */
export const CountryParam = createParamDecorator(
	(data: unknown, ctx: ExecutionContext): CountryType => {
		const request = ctx.switchToHttp().getRequest()
		return request.country // Set by CountryExistsGuard
	},
)
