import { ApiProperty } from '@nestjs/swagger'
import type { CurrencyIdParam } from '@exprealty/shared-domain'

/**
 * DTO for currency ID path parameter.
 */
export class CurrencyIdParamDto implements CurrencyIdParam {
	/**
	 * Currency ID
	 * @example 1
	 */
	@ApiProperty({
		description: 'Currency ID',
		example: 1,
	})
	id!: number
}
