import { AvailableRoutesQueryDto } from '../../src/dto/available-routes-query.dto.js';

describe('AvailableRoutesQueryDto', () => {
	it('should create instance with date strings', () => {
		const dto = new AvailableRoutesQueryDto();
		dto.startDate = '2024-01-01T00:00:00Z';
		dto.endDate = '2024-01-31T23:59:59Z';

		expect(dto.startDate).toBe('2024-01-01T00:00:00Z');
		expect(dto.endDate).toBe('2024-01-31T23:59:59Z');
	});

	it('should allow undefined dates', () => {
		const dto = new AvailableRoutesQueryDto();

		expect(dto.startDate).toBeUndefined();
		expect(dto.endDate).toBeUndefined();
	});

	it('should handle only startDate', () => {
		const dto = new AvailableRoutesQueryDto();
		dto.startDate = '2024-01-01T00:00:00Z';

		expect(dto.startDate).toBe('2024-01-01T00:00:00Z');
		expect(dto.endDate).toBeUndefined();
	});

	it('should handle only endDate', () => {
		const dto = new AvailableRoutesQueryDto();
		dto.endDate = '2024-01-31T23:59:59Z';

		expect(dto.startDate).toBeUndefined();
		expect(dto.endDate).toBe('2024-01-31T23:59:59Z');
	});
});

