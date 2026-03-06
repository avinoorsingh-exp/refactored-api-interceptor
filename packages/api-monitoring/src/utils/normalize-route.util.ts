/**
 * Normalizes a request path to the same format stored in api_route_stats.
 * Replaces UUIDs and numeric path segments with :id so that parameterized
 * routes group together (e.g. /v1/agents/550e8400-... → /v1/agents/:id).
 *
 * Used so route breakdown responses match the normalized routes returned
 * by the available-routes endpoint and stored in the aggregated stats table.
 *
 * @param pathOrUrl - Raw path or URL (query string is stripped)
 * @returns Normalized path suitable for filtering and display
 */
export function normalizeRoute(pathOrUrl: string): string {
	const path = (pathOrUrl || '').split('?')[0]?.trim() || '/';
	// UUID (v4) pattern
	const pathWithIds = path.replace(
		/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
		':id',
	);
	// Standalone numeric path segments (e.g. /123, /456)
	return pathWithIds.replace(/\/\d+(\b|$)/g, '/:id');
}
