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
export function hasValues(arr: readonly unknown[]): boolean {
	return arr.length > 0;
}

/**
 * Normalize statusCode filter: supports single number, array of numbers, or comma-separated string.
 * Used when query params are not transformed by Nest (e.g. statusCode=400,401 arrives as string).
 *
 * @param value - number, number[], or string like "400,401"
 * @returns Array of numbers (empty if none valid)
 */
export function normalizeStatusCodes(
	value: number | number[] | string | undefined | null,
): number[] {
	if (value === undefined || value === null) return [];
	const raw = Array.isArray(value) ? value : [value];
	const expanded = raw.flatMap((v) => {
		if (typeof v === 'number') return [v];
		const asText = typeof v === 'string' ? v : String(v);
		return asText
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n));
	});
	return expanded;
}

/**
 * Normalize route/string filters: supports single string, array, or comma-separated string.
 *
 * @param value - string, string[], or comma-separated string
 * @returns Array of non-empty trimmed strings
 */
export function normalizeStringArray(
	value: string | string[] | undefined | null,
): string[] {
	if (value === undefined || value === null) return [];
	const raw = Array.isArray(value) ? value : [value];
	const expanded = raw.flatMap((v) => {
		const s = (typeof v === 'string' ? v : String(v)).trim();
		if (!s) return [];
		return s.split(',').map((r) => r.trim()).filter(Boolean);
	});
	return expanded;
}


