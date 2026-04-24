import { PageInfoDto } from '../../src/dto/page-info.dto.js';

describe('PageInfoDto', () => {
	it('should create instance with all properties', () => {
		const dto = new PageInfoDto();
		dto.nextCursor = 'test-cursor';
		dto.hasMore = true;
		dto.total = 100;
		dto.totalRequests = 500;
		dto.displayName = 'Test Actor';

		expect(dto.nextCursor).toBe('test-cursor');
		expect(dto.hasMore).toBe(true);
		expect(dto.total).toBe(100);
		expect(dto.totalRequests).toBe(500);
		expect(dto.displayName).toBe('Test Actor');
	});

	it('should allow null values for optional properties', () => {
		const dto = new PageInfoDto();
		dto.nextCursor = null;
		dto.hasMore = false;
		dto.total = null;
		dto.totalRequests = null;
		dto.displayName = null;

		expect(dto.nextCursor).toBeNull();
		expect(dto.hasMore).toBe(false);
		expect(dto.total).toBeNull();
		expect(dto.totalRequests).toBeNull();
		expect(dto.displayName).toBeNull();
	});

	it('should allow undefined values for optional properties', () => {
		const dto = new PageInfoDto();
		dto.nextCursor = null;
		dto.hasMore = false;

		expect(dto.total).toBeUndefined();
		expect(dto.totalRequests).toBeUndefined();
		expect(dto.displayName).toBeUndefined();
	});
});

