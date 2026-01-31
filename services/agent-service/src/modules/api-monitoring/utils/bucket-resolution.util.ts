/**
 * Centralized bucket resolution utility for trend queries.
 * 
 * All trend queries use the same bucket resolution logic:
 * - Daily buckets for ranges ≤14 days
 * - Weekly buckets for ranges >14 days
 * 
 * @public
 */

/**
 * Resolve the appropriate bucket type for a given time range in days.
 * 
 * @param days - Number of days in the time range
 * @returns 'day' for ≤14 days, 'week' for >14 days
 */
export function resolveTrendBucketType(days: number): 'day' | 'week' {
	return days <= 14 ? 'day' : 'week';
}

/**
 * Calculate the number of buckets for a given time range and bucket type.
 * 
 * @param days - Number of days in the time range
 * @param bucketType - 'day' or 'week'
 * @returns Number of buckets
 */
export function calculateBucketCount(days: number, bucketType: 'day' | 'week'): number {
	if (bucketType === 'day') {
		return days;
	}
	// For weeks, calculate number of weeks (round up)
	return Math.ceil(days / 7);
}

/**
 * Get the start of a week for a given date.
 * Week starts on Monday (ISO 8601 week).
 * 
 * @param date - Date to get week start for
 * @returns Start of the week (Monday 00:00:00)
 */
export function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	// Monday is day 1, Sunday is day 0
	// Calculate days to subtract to get to Monday
	const daysToMonday = day === 0 ? 6 : day - 1;
	d.setDate(d.getDate() - daysToMonday);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Get the end of a week for a given date.
 * Week ends on Sunday 23:59:59.
 * 
 * @param date - Date to get week end for
 * @returns End of the week (Sunday 23:59:59.999)
 */
export function getWeekEnd(date: Date): Date {
	const weekStart = getWeekStart(date);
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekEnd.getDate() + 6);
	weekEnd.setHours(23, 59, 59, 999);
	return weekEnd;
}

