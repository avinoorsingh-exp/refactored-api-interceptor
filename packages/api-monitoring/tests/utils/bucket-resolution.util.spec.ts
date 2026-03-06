import { describe, it, expect } from '@jest/globals';
import {
	resolveTrendBucketType,
	calculateBucketCount,
	getWeekStart,
	getWeekEnd,
} from '../../src/utils/bucket-resolution.util.js';

describe('bucket-resolution.util', () => {
	describe('resolveTrendBucketType', () => {
		it('should return day for 14 days', () => {
			expect(resolveTrendBucketType(14)).toBe('day');
		});

		it('should return day for less than 14 days', () => {
			expect(resolveTrendBucketType(7)).toBe('day');
			expect(resolveTrendBucketType(1)).toBe('day');
		});

		it('should return week for more than 14 days', () => {
			expect(resolveTrendBucketType(15)).toBe('week');
			expect(resolveTrendBucketType(30)).toBe('week');
			expect(resolveTrendBucketType(90)).toBe('week');
		});
	});

	describe('calculateBucketCount', () => {
		it('should return days for day bucket type', () => {
			expect(calculateBucketCount(7, 'day')).toBe(7);
			expect(calculateBucketCount(14, 'day')).toBe(14);
			expect(calculateBucketCount(30, 'day')).toBe(30);
		});

		it('should return weeks for week bucket type', () => {
			expect(calculateBucketCount(7, 'week')).toBe(1);
			expect(calculateBucketCount(14, 'week')).toBe(2);
			expect(calculateBucketCount(30, 'week')).toBe(5); // Math.ceil(30/7) = 5
			expect(calculateBucketCount(90, 'week')).toBe(13); // Math.ceil(90/7) = 13
		});
	});

	describe('getWeekStart', () => {
		it('should return Monday for a Monday', () => {
			// 2024-01-01 is a Monday
			const monday = new Date('2024-01-01T12:00:00Z');
			const result = getWeekStart(monday);
			expect(result.getDay()).toBe(1); // Monday
			expect(result.getHours()).toBe(0);
			expect(result.getMinutes()).toBe(0);
			expect(result.getSeconds()).toBe(0);
		});

		it('should return Monday for a Sunday', () => {
			// 2024-01-07 is a Sunday
			const sunday = new Date('2024-01-07T12:00:00Z');
			const result = getWeekStart(sunday);
			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(1); // Should be Jan 1 (Monday)
		});

		it('should return Monday for a Wednesday', () => {
			// 2024-01-03 is a Wednesday
			const wednesday = new Date('2024-01-03T12:00:00Z');
			const result = getWeekStart(wednesday);
			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(1); // Should be Jan 1 (Monday)
		});

		it('should throw error for invalid date', () => {
			const invalidDate = new Date('invalid');
			expect(() => getWeekStart(invalidDate)).toThrow('Invalid date provided to getWeekStart');
		});
	});

	describe('getWeekEnd', () => {
		it('should return Sunday for a Monday', () => {
			// 2024-01-01 is a Monday
			const monday = new Date('2024-01-01T12:00:00Z');
			const result = getWeekEnd(monday);
			expect(result.getDay()).toBe(0); // Sunday
			expect(result.getHours()).toBe(23);
			expect(result.getMinutes()).toBe(59);
			expect(result.getSeconds()).toBe(59);
			expect(result.getMilliseconds()).toBe(999);
		});

		it('should return Sunday for a Sunday', () => {
			// 2024-01-07 is a Sunday
			const sunday = new Date('2024-01-07T12:00:00Z');
			const result = getWeekEnd(sunday);
			expect(result.getDay()).toBe(0); // Sunday
			expect(result.getDate()).toBe(7); // Should be Jan 7 (Sunday)
		});

		it('should return Sunday 6 days after Monday', () => {
			// 2024-01-01 is a Monday
			const monday = new Date('2024-01-01T12:00:00Z');
			const result = getWeekEnd(monday);
			expect(result.getDate()).toBe(7); // Should be Jan 7 (Sunday)
		});
	});
});

