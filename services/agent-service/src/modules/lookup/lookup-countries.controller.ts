import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExtraModels } from '@nestjs/swagger';
import { CountriesService } from '../countries/countries.service.js';
import { CountryLookupItemDto } from '../countries/dto/country-lookup-item.dto.js';

@ApiTags('lookup')
@ApiExtraModels(CountryLookupItemDto)
@Controller('v1/lookup/countries')
export class LookupCountriesController {
	constructor(private readonly countriesService: CountriesService) {}

	@Get()
	@ApiOperation({ summary: 'List all countries (US first, then sorted by alpha2)' })
	@ApiResponse({ status: 200, description: 'List of countries', type: [CountryLookupItemDto] })
	async listAll(): Promise<CountryLookupItemDto[]> {
		const countries = await this.countriesService.findAllCountries();
		const sorted = countries.sort((a, b) => {
			if (a.alpha2 === 'US') return -1;
			if (b.alpha2 === 'US') return 1;
			return a.alpha2.localeCompare(b.alpha2);
		});
		return sorted.map((c) => ({ alpha2: c.alpha2, name: c.name }));
	}
}
