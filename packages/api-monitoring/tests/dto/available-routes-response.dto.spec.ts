import { describe, it, expect } from '@jest/globals';
import { AvailableRoutesResponseDto } from '../../src/dto/available-routes-response.dto.js';

describe('AvailableRoutesResponseDto', () => {
	it('should create instance with routes and error codes', () => {
		const dto = new AvailableRoutesResponseDto();
		dto.routes = ['/v1/agents', '/v1/companies', '/v1/users'];
		dto.errorCodes = ['200', '400', '401', '404', '500'];

		expect(dto.routes).toEqual(['/v1/agents', '/v1/companies', '/v1/users']);
		expect(dto.errorCodes).toEqual(['200', '400', '401', '404', '500']);
	});

	it('should handle empty arrays', () => {
		const dto = new AvailableRoutesResponseDto();
		dto.routes = [];
		dto.errorCodes = [];

		expect(dto.routes).toEqual([]);
		expect(dto.errorCodes).toEqual([]);
	});

	it('should handle single route and error code', () => {
		const dto = new AvailableRoutesResponseDto();
		dto.routes = ['/v1/agents'];
		dto.errorCodes = ['200'];

		expect(dto.routes).toEqual(['/v1/agents']);
		expect(dto.errorCodes).toEqual(['200']);
	});
});

