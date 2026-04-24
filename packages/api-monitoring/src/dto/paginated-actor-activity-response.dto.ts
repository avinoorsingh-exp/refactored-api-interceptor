import { ApiProperty } from '@nestjs/swagger';
import { PageInfoDto } from './page-info.dto.js';
import { ApiRequestLogRowDto } from './api-request-log-row.dto.js';

/**
 * Paginated actor activity response DTO.
 * 
 * @public
 */
export class PaginatedActorActivityResponseDto {
	/**
	 * Array of actor activity logs.
	 */
	@ApiProperty({
		description: 'Array of actor activity logs',
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

