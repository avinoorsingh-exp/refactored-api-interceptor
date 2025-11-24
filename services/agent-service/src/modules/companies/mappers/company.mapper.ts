import type { Company } from '@exprealty/shared-domain'
import { mapAuditFields } from '../../../common/mappers/audit.mapper.js'
import type { CompanyResponseDto } from '../dto/company-response.dto.js'

/**
 * Mapper for Company entity responses.
 * 
 * Handles transformation from internal domain types (camelCase)
 * to external API response DTOs (snake_case for timestamps).
 */
export class CompanyMapper {
	/**
	 * Maps a single Company domain object to CompanyResponseDto.
	 * 
	 * @param company - Company domain object from service layer
	 * @returns API response DTO with snake_case audit fields
	 */
	static toResponse(company: Company): CompanyResponseDto {
		return {
			id: company.id,
			name: company.name as string,
			email: company.email as string,
			...mapAuditFields(company),
		}
	}

	/**
	 * Maps an array of Company domain objects to CompanyResponseDto array.
	 * 
	 * @param companies - Array of Company domain objects
	 * @returns Array of API response DTOs
	 */
	static toResponseList(companies: Company[]): CompanyResponseDto[] {
		return companies.map(c => this.toResponse(c))
	}
}
