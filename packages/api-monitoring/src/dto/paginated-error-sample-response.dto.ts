import { ApiProperty } from '@nestjs/swagger';
import { ApiRequestLogEntity } from '@exprealty/database';
import { PageInfoDto } from './page-info.dto.js';

/**
 * Paginated error sample response DTO.
 * 
 * @public
 */
export class PaginatedErrorSampleResponseDto {
	/**
	 * Array of error sample logs.
	 */
	@ApiProperty({
		description: 'Array of error sample logs',
		type: [ApiRequestLogEntity],
	})
	data!: ApiRequestLogEntity[];

	/**
	 * Pagination metadata.
	 */
	@ApiProperty({
		description: 'Pagination metadata',
		type: PageInfoDto,
	})
	pageInfo!: PageInfoDto;
}

