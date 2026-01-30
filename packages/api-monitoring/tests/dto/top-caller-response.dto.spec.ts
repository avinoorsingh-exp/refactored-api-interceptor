import { describe, it, expect } from '@jest/globals';
import { TopCallerResponseDto } from '../../src/dto/top-caller-response.dto.js';

describe('TopCallerResponseDto', () => {
	it('should create instance with all properties', () => {
		const dto = new TopCallerResponseDto();
		dto.actorId = '550e8400-e29b-41d4-a716-446655440000';
		dto.actorType = 'USER';
		dto.displayName = 'API Key: Zapier';
		dto.requestCount = 1250;
		dto.errorCount = 15;

		expect(dto.actorId).toBe('550e8400-e29b-41d4-a716-446655440000');
		expect(dto.actorType).toBe('USER');
		expect(dto.displayName).toBe('API Key: Zapier');
		expect(dto.requestCount).toBe(1250);
		expect(dto.errorCount).toBe(15);
	});

	it('should handle zero values', () => {
		const dto = new TopCallerResponseDto();
		dto.actorId = 'test-id';
		dto.actorType = 'ANONYMOUS';
		dto.displayName = 'Anonymous';
		dto.requestCount = 0;
		dto.errorCount = 0;

		expect(dto.requestCount).toBe(0);
		expect(dto.errorCount).toBe(0);
	});

	it('should handle different actor types', () => {
		const dto = new TopCallerResponseDto();
		dto.actorId = 'test-id';
		dto.actorType = 'API_KEY';
		dto.displayName = 'API Key: Test';
		dto.requestCount = 100;
		dto.errorCount = 5;

		expect(dto.actorType).toBe('API_KEY');
		expect(dto.displayName).toBe('API Key: Test');
	});
});

