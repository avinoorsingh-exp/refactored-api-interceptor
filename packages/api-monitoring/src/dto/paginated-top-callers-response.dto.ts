import { ApiProperty } from '@nestjs/swagger';
import { TopCallerResponseDto } from './top-caller-response.dto.js';
import { PageInfoDto } from './page-info.dto.js';

/**
 * Paginated top callers response DTO.
 * 
 * @public
 */
export class PaginatedTopCallersResponseDto {
	/**
	 * Array of top caller statistics.
	 */
	@ApiProperty({
		description: 'Array of top caller statistics',
		type: [TopCallerResponseDto],
	})
	data!: TopCallerResponseDto[];

	/**
	 * Pagination metadata.
	 */
	@ApiProperty({
		description: 'Pagination metadata',
		type: PageInfoDto,
	})
	pageInfo!: PageInfoDto;
}

