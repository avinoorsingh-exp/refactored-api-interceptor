import { describe, it, expect } from '@jest/globals';
import { toArray, hasValues } from '../../src/utils/filter.util.js';

describe('filter.util', () => {
	describe('toArray', () => {
		it('should return empty array for undefined', () => {
			expect(toArray(undefined)).toEqual([]);
		});

		it('should return empty array for null', () => {
			expect(toArray(null)).toEqual([]);
		});

		it('should return array for single value', () => {
			expect(toArray('value')).toEqual(['value']);
			expect(toArray(123)).toEqual([123]);
			expect(toArray(true)).toEqual([true]);
		});

		it('should return array for array input', () => {
			expect(toArray(['value1', 'value2'])).toEqual(['value1', 'value2']);
			expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
		});

		it('should filter out null and undefined from arrays', () => {
			expect(toArray(['value1', null, 'value2', undefined, 'value3'])).toEqual([
				'value1',
				'value2',
				'value3',
			]);
		});

		it('should handle empty arrays', () => {
			expect(toArray([])).toEqual([]);
		});
	});

	describe('hasValues', () => {
		it('should return true for non-empty array', () => {
			expect(hasValues([1])).toBe(true);
			expect(hasValues([1, 2, 3])).toBe(true);
			expect(hasValues(['value'])).toBe(true);
		});

		it('should return false for empty array', () => {
			expect(hasValues([])).toBe(false);
		});
	});
});

