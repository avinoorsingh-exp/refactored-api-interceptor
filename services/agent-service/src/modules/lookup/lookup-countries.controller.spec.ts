import { LookupCountriesController } from './lookup-countries.controller.js';
import { CountriesService } from '../countries/countries.service.js';
import type { Country } from '@exprealty/shared-domain';

describe('LookupCountriesController', () => {
	let controller: LookupCountriesController;
	let service: jest.Mocked<Pick<CountriesService, 'findAllCountries'>>;

	const inputCountries: Country[] = [
		{ id: 2, name: 'Canada', alpha2: 'CA', alpha3: 'CAN', number: 124, dialingCode: 1, created: new Date(), lastModified: new Date(), modifiedBy: 'system' },
		{ id: 1, name: 'United States of America', alpha2: 'US', alpha3: 'USA', number: 840, dialingCode: 1, created: new Date(), lastModified: new Date(), modifiedBy: 'system' },
		{ id: 3, name: 'Mexico', alpha2: 'MX', alpha3: 'MEX', number: 484, dialingCode: 52, created: new Date(), lastModified: new Date(), modifiedBy: 'system' },
	];

	beforeEach(() => {
		service = {
			findAllCountries: jest.fn(),
		};
		controller = new LookupCountriesController(service as unknown as CountriesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GET /v1/lookup/countries (listAll)', () => {
		it('should return US first then rest sorted by alpha2', async () => {
			service.findAllCountries.mockResolvedValue([...inputCountries]);

			const result = await controller.listAll();

			expect(result).toEqual([
				{ alpha2: 'US', name: 'United States of America' },
				{ alpha2: 'CA', name: 'Canada' },
				{ alpha2: 'MX', name: 'Mexico' },
			]);
			expect(service.findAllCountries).toHaveBeenCalledTimes(1);
		});

		it('should return only US when single country', async () => {
			const usOnly = [
				{ id: 1, name: 'United States of America', alpha2: 'US', alpha3: 'USA', number: 840, dialingCode: 1, created: new Date(), lastModified: new Date(), modifiedBy: 'system' } as Country,
			];
			service.findAllCountries.mockResolvedValue(usOnly);

			const result = await controller.listAll();

			expect(result).toEqual([{ alpha2: 'US', name: 'United States of America' }]);
		});

		it('should return empty array when no countries', async () => {
			service.findAllCountries.mockResolvedValue([]);

			const result = await controller.listAll();

			expect(result).toEqual([]);
		});

		it('should put US first when not in alpha2 order', async () => {
			service.findAllCountries.mockResolvedValue([
				{ ...inputCountries[2] },
				{ ...inputCountries[0] },
				{ ...inputCountries[1] },
			]);

			const result = await controller.listAll();

			expect(result[0]).toEqual({ alpha2: 'US', name: 'United States of America' });
			expect(result).toHaveLength(3);
		});
	});
});
