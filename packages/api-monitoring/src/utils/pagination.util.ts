/**
 * Cursor-based pagination utilities.
 * 
 * Provides a standardized pagination contract for all API monitoring endpoints.
 * Uses cursor-based pagination (timestamp + id) for stable, deterministic ordering.
 * 
 * Cursor format: base64-encoded JSON string containing cursor data
 * Example: {"timestamp": "2024-01-01T00:00:00Z", "id": "uuid"}
 * 
 * @public
 */

/**
 * Pagination request parameters.
 * All parameters are optional to maintain backward compatibility.
 */
export interface PaginationParams {
	/**
	 * Maximum number of results to return.
	 * Default: 50
	 * Max: 200
	 */
	limit?: number;

	/**
	 * Opaque cursor string for pagination.
	 * Decoded to extract timestamp and id for stable ordering.
	 */
	cursor?: string;
}

/**
 * Pagination response metadata.
 */
export interface PageInfo {
	/**
	 * Cursor for the next page.
	 * null if there are no more results.
	 */
	nextCursor: string | null;

	/**
	 * Whether there are more results available.
	 */
	hasMore: boolean;

	/**
	 * Total number of items matching the query (across all pages).
	 * Optional - may not be available for all endpoints.
	 */
	total?: number | null;

	/**
	 * Total number of requests (for top-callers endpoint).
	 * Optional - helps explain why sum of requestCounts may not equal this value.
	 */
	totalRequests?: number | null;
}

/**
 * Standardized paginated response shape.
 */
export interface PaginatedResponse<T> {
	/**
	 * Array of results for the current page.
	 */
	data: T[];

	/**
	 * Pagination metadata.
	 */
	pageInfo: PageInfo;
}

/**
 * Internal cursor data structure.
 * Used for encoding/decoding cursors.
 */
interface CursorData {
	timestamp: string;
	id: string;
}

/**
 * Decode a cursor string into cursor data.
 * 
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor data or null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
	try {
		const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
		const data = JSON.parse(decoded) as CursorData;
		
		// Validate cursor structure
		if (!data.timestamp || !data.id) {
			return null;
		}
		
		return data;
	} catch {
		return null;
	}
}

/**
 * Encode cursor data into a cursor string.
 * 
 * @param timestamp - ISO timestamp string
 * @param id - Record ID (UUID)
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(timestamp: string, id: string): string {
	const data: CursorData = { timestamp, id };
	const json = JSON.stringify(data);
	return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Normalize pagination limit with defaults and max constraints.
 * 
 * @param limit - Requested limit
 * @param defaultLimit - Default limit if not provided
 * @param maxLimit - Maximum allowed limit
 * @returns Normalized limit value, or null if limit is -1 (fetch all)
 */
export function normalizeLimit(
	limit?: number | null,
	defaultLimit = 50,
	maxLimit = 200,
): number | null {
	if (limit == null) {
		return defaultLimit;
	}
	
	// Special case: -1 means fetch all (no limit)
	if (limit === -1) {
		return null; // null indicates no limit
	}
	
	// Ensure limit is a positive integer (0 becomes 1)
	const normalized = Math.max(1, Math.floor(limit));
	
	// Enforce maximum
	return Math.min(normalized, maxLimit);
}

/**
 * Create paginated response from results.
 * 
 * @param data - Array of results
 * @param limit - Requested limit
 * @param getCursor - Function to extract cursor from a result item
 * @returns Paginated response with pageInfo
 */
export function createPaginatedResponse<T>(
	data: T[],
	limit: number,
	getCursor: (item: T) => { timestamp: string; id: string },
): PaginatedResponse<T> {
	// If we got more results than requested, there's a next page
	const hasMore = data.length > limit;
	
	// If we have more results, remove the extra one and create cursor from last item
	if (hasMore) {
		data = data.slice(0, limit);
	}
	
	// Create next cursor from the last item
	const nextCursor = data.length > 0
		? encodeCursor(
			getCursor(data[data.length - 1]).timestamp,
			getCursor(data[data.length - 1]).id,
		)
		: null;
	
	return {
		data,
		pageInfo: {
			nextCursor: hasMore ? nextCursor : null,
			hasMore,
		},
	};
}

