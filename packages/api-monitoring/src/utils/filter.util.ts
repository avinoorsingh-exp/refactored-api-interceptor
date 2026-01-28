/**
 * Utility functions for normalizing filter inputs.
 * 
 * Converts single values to arrays for consistent multi-select filter handling.
 * 
 * @public
 */

/**
 * Convert a value to an array, handling single values and arrays.
 * 
 * - If value is undefined/null → returns empty array
 * - If value is already an array → returns it (filtered for truthy values)
 * - If value is a single value → returns array with that value
 * 
 * @param value - Single value or array to normalize
 * @returns Array of values (empty if input was undefined/null)
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value.filter((item) => item !== undefined && item !== null);
	}
	return [value];
}

/**
 * Check if an array has any values (non-empty).
 * 
 * @param arr - Array to check
 * @returns True if array has at least one element
 */
export function hasValues<T>(arr: T[]): boolean {
	return arr.length > 0;
}


