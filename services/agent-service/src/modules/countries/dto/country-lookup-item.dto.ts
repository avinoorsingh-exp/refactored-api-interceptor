import { ApiProperty } from '@nestjs/swagger';

/**
 * Single item in the country lookup list (alpha2 + name).
 */
export class CountryLookupItemDto {
	@ApiProperty({
		description: 'ISO 3166-1 alpha-2 country code',
		example: 'US',
	})
	alpha2!: string;

	@ApiProperty({
		description: 'Country name',
		example: 'United States',
	})
	name!: string;
}
