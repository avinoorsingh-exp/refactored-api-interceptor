/**
 * Test Utilities - Time Manipulation
 *
 * Utilities for controlling time in tests (dates, timers, delays).
 *
 * @example
 * ```typescript
 * import { freezeTime, advanceTime, restoreTime } from '../../../test/utils/time';
 *
 * describe('MyService', () => {
 *   beforeEach(() => {
 *     freezeTime(new Date('2025-01-15T12:00:00Z'));
 *   });
 *
 *   afterEach(() => {
 *     restoreTime();
 *   });
 *
 *   it('should use frozen time', () => {
 *     expect(new Date().toISOString()).toBe('2025-01-15T12:00:00.000Z');
 *   });
 * });
 * ```
 */

export function withFixedTime(dateIso: string, fn: () => Promise<void> | void) {
	jest.useFakeTimers()
	jest.setSystemTime(new Date(dateIso))
	const run = async () => {
		await fn()
	}
	return run().finally(() => jest.useRealTimers())
}

/**
 * Freeze time to a specific date
 *
 * @param date - Date to freeze time at
 *
 * @example
 * ```typescript
 * freezeTime(new Date('2025-01-15T12:00:00Z'));
 * expect(Date.now()).toBe(new Date('2025-01-15T12:00:00Z').getTime());
 * ```
 */
export function freezeTime(date: Date | string | number): void {
	const timestamp = typeof date === 'number' ? date : new Date(date).getTime()
	jest.useFakeTimers()
	jest.setSystemTime(timestamp)
}

/**
 * Advance time by milliseconds
 *
 * @param ms - Milliseconds to advance
 *
 * @example
 * ```typescript
 * freezeTime(new Date('2025-01-15T12:00:00Z'));
 * advanceTime(1000 * 60 * 60); // Advance 1 hour
 * expect(new Date().toISOString()).toBe('2025-01-15T13:00:00.000Z');
 * ```
 */
export function advanceTime(ms: number): void {
	jest.advanceTimersByTime(ms)
}

/**
 * Run all pending timers
 *
 * @example
 * ```typescript
 * setTimeout(() => callback(), 1000);
 * runAllTimers();
 * expect(callback).toHaveBeenCalled();
 * ```
 */
export function runAllTimers(): void {
	jest.runAllTimers()
}

/**
 * Run only currently pending timers (not newly scheduled ones)
 *
 * @example
 * ```typescript
 * setTimeout(() => callback1(), 1000);
 * runOnlyPendingTimers();
 * expect(callback1).toHaveBeenCalled();
 * ```
 */
export function runOnlyPendingTimers(): void {
	jest.runOnlyPendingTimers()
}

/**
 * Restore real timers
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   restoreTime();
 * });
 * ```
 */
export function restoreTime(): void {
	jest.useRealTimers()
}

/**
 * Wait for a promise to resolve (useful for async code)
 *
 * @example
 * ```typescript
 * await waitForPromises();
 * expect(asyncResult).toBeDefined();
 * ```
 */
export async function waitForPromises(): Promise<void> {
	await new Promise((resolve) => setImmediate(resolve))
}

/**
 * Create a date in the past
 *
 * @param daysAgo - Number of days ago
 * @returns Date object
 *
 * @example
 * ```typescript
 * const lastWeek = daysAgo(7);
 * expect(lastWeek).toBeInstanceOf(Date);
 * ```
 */
export function daysAgo(daysAgo: number): Date {
	const date = new Date()
	date.setDate(date.getDate() - daysAgo)
	return date
}

/**
 * Create a date in the future
 *
 * @param daysFromNow - Number of days from now
 * @returns Date object
 *
 * @example
 * ```typescript
 * const nextWeek = daysFromNow(7);
 * expect(nextWeek.getTime()).toBeGreaterThan(Date.now());
 * ```
 */
export function daysFromNow(daysFromNow: number): Date {
	const date = new Date()
	date.setDate(date.getDate() + daysFromNow)
	return date
}

/**
 * Sleep for a specified duration (use with fake timers)
 *
 * @param ms - Milliseconds to sleep
 *
 * @example
 * ```typescript
 * const promise = sleep(1000).then(() => callback());
 * advanceTime(1000);
 * await promise;
 * expect(callback).toHaveBeenCalled();
 * ```
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
