import type { Region } from '@exprealty/shared-domain'
import { mapAuditFields } from '../../../common/mappers/audit.mapper.js'
import type { RegionResponseDto } from '../dto/region-response.dto.js'

/**
 * Mapper for Region entity responses.
 * 
 * Handles transformation from internal domain types (camelCase)
 * to external API response DTOs (snake_case for timestamps).
 */
export class RegionMapper {
	/**
	 * Maps a single Region domain object to RegionResponseDto.
	 * 
	 * @param region - Region domain object from service layer
	 * @returns API response DTO with snake_case audit fields
	 */
	static toResponse(region: Region): RegionResponseDto {
		return {
			id: region.id,
			name: region.name,
			...mapAuditFields(region),
		}
	}

	/**
	 * Maps an array of Region domain objects to RegionResponseDto array.
	 * 
	 * @param regions - Array of Region domain objects
	 * @returns Array of API response DTOs
	 */
	static toResponseList(regions: Region[]): RegionResponseDto[] {
		return regions.map(r => this.toResponse(r))
	}
}
