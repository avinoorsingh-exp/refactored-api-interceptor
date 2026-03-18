import { describe, it, expect } from '@jest/globals';
import { PaginatedErrorSampleResponseDto } from '../../src/dto/paginated-error-sample-response.dto.js';
import { PaginatedActorActivityResponseDto } from '../../src/dto/paginated-actor-activity-response.dto.js';
import { PaginatedTopCallersResponseDto } from '../../src/dto/paginated-top-callers-response.dto.js';
import { PageInfoDto } from '../../src/dto/page-info.dto.js';

describe('PaginatedResponseDto', () => {
	describe('PaginatedErrorSampleResponseDto', () => {
		it('should create instance with data and pageInfo', () => {
			const dto = new PaginatedErrorSampleResponseDto();
			const pageInfo = new PageInfoDto();
			pageInfo.nextCursor = 'cursor-123';
			pageInfo.hasMore = true;

			dto.data = [];
			dto.pageInfo = pageInfo;

			expect(dto.data).toEqual([]);
			expect(dto.pageInfo).toBe(pageInfo);
			expect(dto.pageInfo.nextCursor).toBe('cursor-123');
			expect(dto.pageInfo.hasMore).toBe(true);
		});

		it('should handle empty data array', () => {
			const dto = new PaginatedErrorSampleResponseDto();
			const pageInfo = new PageInfoDto();
			pageInfo.nextCursor = null;
			pageInfo.hasMore = false;

			dto.data = [];
			dto.pageInfo = pageInfo;

			expect(dto.data).toEqual([]);
			expect(dto.pageInfo.hasMore).toBe(false);
		});
	});

	describe('PaginatedActorActivityResponseDto', () => {
		it('should create instance with data and pageInfo', () => {
			const dto = new PaginatedActorActivityResponseDto();
			const pageInfo = new PageInfoDto();
			pageInfo.nextCursor = 'cursor-456';
			pageInfo.hasMore = false;
			pageInfo.displayName = 'Test User';

			dto.data = [];
			dto.pageInfo = pageInfo;

			expect(dto.data).toEqual([]);
			expect(dto.pageInfo).toBe(pageInfo);
			expect(dto.pageInfo.displayName).toBe('Test User');
		});
	});

	describe('PaginatedTopCallersResponseDto', () => {
		it('should create instance with data and pageInfo', () => {
			const dto = new PaginatedTopCallersResponseDto();
			const pageInfo = new PageInfoDto();
			pageInfo.nextCursor = 'cursor-789';
			pageInfo.hasMore = true;
			pageInfo.total = 100;

			dto.data = [];
			dto.pageInfo = pageInfo;

			expect(dto.data).toEqual([]);
			expect(dto.pageInfo).toBe(pageInfo);
			expect(dto.pageInfo.total).toBe(100);
		});
	});
});

