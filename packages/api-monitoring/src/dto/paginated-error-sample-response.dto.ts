import { ApiProperty } from '@nestjs/swagger';
import { PageInfoDto } from './page-info.dto.js';
import { ApiRequestLogRowDto } from './api-request-log-row.dto.js';

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
		type: [ApiRequestLogRowDto],
	})
	data!: ApiRequestLogRowDto[];

	/**
	 * Pagination metadata.
	 */
	@ApiProperty({
		description: 'Pagination metadata',
		type: PageInfoDto,
	})
	pageInfo!: PageInfoDto;
}

