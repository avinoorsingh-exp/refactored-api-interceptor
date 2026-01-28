import { describe, it, expect } from '@jest/globals';
import {
	decodeCursor,
	encodeCursor,
	normalizeLimit,
	createPaginatedResponse,
} from '../../src/utils/pagination.util.js';

describe('Pagination Utilities', () => {
	describe('encodeCursor', () => {
		it('should encode cursor data to base64 string', () => {
			const timestamp = '2024-01-01T00:00:00.000Z';
			const id = '550e8400-e29b-41d4-a716-446655440000';
			
			const cursor = encodeCursor(timestamp, id);
			
			expect(cursor).toBeTruthy();
			expect(typeof cursor).toBe('string');
			
			// Verify it can be decoded
			const decoded = decodeCursor(cursor);
			expect(decoded).toEqual({ timestamp, id });
		});

		it('should produce different cursors for different inputs', () => {
			const cursor1 = encodeCursor('2024-01-01T00:00:00.000Z', 'id1');
			const cursor2 = encodeCursor('2024-01-02T00:00:00.000Z', 'id2');
			
			expect(cursor1).not.toBe(cursor2);
		});
	});

	describe('decodeCursor', () => {
		it('should decode valid cursor string', () => {
			const timestamp = '2024-01-01T00:00:00.000Z';
			const id = '550e8400-e29b-41d4-a716-446655440000';
			const cursor = encodeCursor(timestamp, id);
			
			const decoded = decodeCursor(cursor);
			
			expect(decoded).toEqual({ timestamp, id });
		});

		it('should return null for invalid base64 string', () => {
			const decoded = decodeCursor('invalid-base64!!!');
			expect(decoded).toBeNull();
		});

		it('should return null for invalid JSON in cursor', () => {
			const invalidJson = Buffer.from('not-json').toString('base64');
			const decoded = decodeCursor(invalidJson);
			expect(decoded).toBeNull();
		});

		it('should return null for cursor missing timestamp', () => {
			const invalidData = Buffer.from(JSON.stringify({ id: '123' })).toString('base64');
			const decoded = decodeCursor(invalidData);
			expect(decoded).toBeNull();
		});

		it('should return null for cursor missing id', () => {
			const invalidData = Buffer.from(JSON.stringify({ timestamp: '2024-01-01T00:00:00.000Z' })).toString('base64');
			const decoded = decodeCursor(invalidData);
			expect(decoded).toBeNull();
		});
	});

	describe('normalizeLimit', () => {
		it('should return default limit when limit is undefined', () => {
			const result = normalizeLimit(undefined, 50, 200);
			expect(result).toBe(50);
		});

		it('should return default limit when limit is null', () => {
			const result = normalizeLimit(null as any, 50, 200);
			expect(result).toBe(50);
		});

		it('should return provided limit when within bounds', () => {
			const result = normalizeLimit(25, 50, 200);
			expect(result).toBe(25);
		});

		it('should enforce maximum limit', () => {
			const result = normalizeLimit(500, 50, 200);
			expect(result).toBe(200);
		});

		it('should enforce minimum limit of 1', () => {
			const result = normalizeLimit(0, 50, 200);
			expect(result).toBe(1);
		});

		it('should enforce minimum limit of 1 for negative values', () => {
			const result = normalizeLimit(-10, 50, 200);
			expect(result).toBe(1);
		});

		it('should floor decimal values', () => {
			const result = normalizeLimit(25.7, 50, 200);
			expect(result).toBe(25);
		});

		it('should use custom default and max limits', () => {
			const result1 = normalizeLimit(undefined, 100, 500);
			expect(result1).toBe(100);
			
			const result2 = normalizeLimit(1000, 100, 500);
			expect(result2).toBe(500);
		});
	});

	describe('createPaginatedResponse', () => {
		interface TestItem {
			id: string;
			timestamp: string;
			name: string;
		}

		it('should create paginated response with hasMore when data exceeds limit', () => {
			const items: TestItem[] = [
				{ id: '1', timestamp: '2024-01-01T00:00:00.000Z', name: 'Item 1' },
				{ id: '2', timestamp: '2024-01-02T00:00:00.000Z', name: 'Item 2' },
				{ id: '3', timestamp: '2024-01-03T00:00:00.000Z', name: 'Item 3' },
			];
			
			const result = createPaginatedResponse(items, 2, (item) => ({
				timestamp: item.timestamp,
				id: item.id,
			}));
			
			expect(result.data).toHaveLength(2);
			expect(result.data[0].name).toBe('Item 1');
			expect(result.data[1].name).toBe('Item 2');
			expect(result.pageInfo.hasMore).toBe(true);
			expect(result.pageInfo.nextCursor).toBeTruthy();
		});

		it('should create paginated response without hasMore when data is within limit', () => {
			const items: TestItem[] = [
				{ id: '1', timestamp: '2024-01-01T00:00:00.000Z', name: 'Item 1' },
				{ id: '2', timestamp: '2024-01-02T00:00:00.000Z', name: 'Item 2' },
			];
			
			const result = createPaginatedResponse(items, 5, (item) => ({
				timestamp: item.timestamp,
				id: item.id,
			}));
			
			expect(result.data).toHaveLength(2);
			expect(result.pageInfo.hasMore).toBe(false);
			expect(result.pageInfo.nextCursor).toBeNull();
		});

		it('should create paginated response with null cursor when no data', () => {
			const items: TestItem[] = [];
			
			const result = createPaginatedResponse(items, 10, (item) => ({
				timestamp: item.timestamp,
				id: item.id,
			}));
			
			expect(result.data).toHaveLength(0);
			expect(result.pageInfo.hasMore).toBe(false);
			expect(result.pageInfo.nextCursor).toBeNull();
		});

		it('should create cursor from last item when hasMore is true', () => {
			const items: TestItem[] = [
				{ id: '1', timestamp: '2024-01-01T00:00:00.000Z', name: 'Item 1' },
				{ id: '2', timestamp: '2024-01-02T00:00:00.000Z', name: 'Item 2' },
				{ id: '3', timestamp: '2024-01-03T00:00:00.000Z', name: 'Item 3' },
			];
			
			const result = createPaginatedResponse(items, 2, (item) => ({
				timestamp: item.timestamp,
				id: item.id,
			}));
			
			// Verify cursor can be decoded and matches last item
			const decoded = decodeCursor(result.pageInfo.nextCursor!);
			expect(decoded).toEqual({
				timestamp: '2024-01-02T00:00:00.000Z',
				id: '2',
			});
		});

		it('should handle exact limit match correctly', () => {
			const items: TestItem[] = [
				{ id: '1', timestamp: '2024-01-01T00:00:00.000Z', name: 'Item 1' },
				{ id: '2', timestamp: '2024-01-02T00:00:00.000Z', name: 'Item 2' },
			];
			
			const result = createPaginatedResponse(items, 2, (item) => ({
				timestamp: item.timestamp,
				id: item.id,
			}));
			
			expect(result.data).toHaveLength(2);
			expect(result.pageInfo.hasMore).toBe(false);
			expect(result.pageInfo.nextCursor).toBeNull();
		});
	});
});


