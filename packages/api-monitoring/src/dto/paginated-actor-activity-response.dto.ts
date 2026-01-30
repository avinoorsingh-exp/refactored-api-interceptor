import { ApiProperty } from '@nestjs/swagger';
import { ApiRequestLogEntity } from '@exprealty/database';
import { PageInfoDto } from './page-info.dto.js';

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

