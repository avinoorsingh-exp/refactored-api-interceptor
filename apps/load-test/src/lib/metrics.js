/**
 * Curated hotspot Trend metrics for per-endpoint/variant regression tracking.
 *
 * k6 summary-export does not provide per-tag latency. Instead, we create
 * low-cardinality custom Trend metrics for a bounded allowlist of endpoints
 * and variant dimensions (includes, search mode, page size bucket).
 *
 * Env vars:
 *   PERF_HOTSPOT_ENDPOINTS — comma list (default: "GET /v1/agents,GET /v1/companies,GET /v1/agent-companies")
 *
 * Metric naming scheme:
 *   hs_{endpoint}                    — aggregate per endpoint
 *   hs_{endpoint}_inc_{level}        — includes dimension
 *   hs_{endpoint}_search_{mode}      — search mode dimension
 *   hs_{endpoint}_ps_{bucket}        — page size dimension
 *
 * All metrics are declared at init time (k6 requirement). Cardinality is bounded:
 *   3 endpoints × (1 + 3 + 4 + 4) = 36 metrics max at defaults.
 */
import { Trend } from 'k6/metrics';

// ── Bounded variant sets (fixed, not from env) ──────────────────
const INCLUDES_LEVELS = ['none', 'light', 'heavy'];
const SEARCH_MODES = ['none', 'prefix', 'contains', 'exact'];
const PAGE_SIZE_BUCKETS = ['10', '25', '50', '100'];

// ── Parse hotspot allowlist ─────────────────────────────────────
const DEFAULT_HOTSPOTS = 'GET /v1/agents,GET /v1/companies,GET /v1/agent-companies';
const rawHotspots = (__ENV.PERF_HOTSPOT_ENDPOINTS || DEFAULT_HOTSPOTS);
const HOTSPOT_LIST = rawHotspots.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Normalize endpoint key for metric name: "GET /v1/agents" → "agents"
 */
function endpointKey(endpoint) {
	return endpoint
		.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, '')
		.replace(/^\/v1\//, '')
		.replace(/[^a-zA-Z0-9]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

// ── Build all metrics at init time ──────────────────────────────
const trendMap = {};

for (const ep of HOTSPOT_LIST) {
	const key = endpointKey(ep);

	// Aggregate
	trendMap[`hs_${key}`] = new Trend(`hs_${key}`, true);

	// Includes dimension
	for (const inc of INCLUDES_LEVELS) {
		trendMap[`hs_${key}_inc_${inc}`] = new Trend(`hs_${key}_inc_${inc}`, true);
	}

	// Search mode dimension
	for (const sm of SEARCH_MODES) {
		trendMap[`hs_${key}_search_${sm}`] = new Trend(`hs_${key}_search_${sm}`, true);
	}

	// Page size dimension
	for (const ps of PAGE_SIZE_BUCKETS) {
		trendMap[`hs_${key}_ps_${ps}`] = new Trend(`hs_${key}_ps_${ps}`, true);
	}
}

// ── Build lookup set for fast matching ──────────────────────────
// Map "GET" + "/v1/agents" → "agents", etc.
const hotspotLookup = {};
for (const ep of HOTSPOT_LIST) {
	const parts = ep.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.*)/i);
	if (parts) {
		const method = parts[1].toUpperCase();
		const path = parts[2].trim();
		hotspotLookup[`${method} ${path}`] = endpointKey(ep);
	}
}

/**
 * Record a request duration into hotspot Trend metrics if the endpoint is allowed.
 *
 * Call this after each HTTP request with:
 *   - method: "GET", "POST", etc.
 *   - path: the path portion (e.g., "/v1/agents" — before query string)
 *   - durationMs: response.timings.duration
 *   - tags: { includesLevel, searchMode, pageSize } from request params
 *
 * @param {string} method
 * @param {string} path — path without query string
 * @param {number} durationMs
 * @param {{ includesLevel?: string, searchMode?: string, pageSize?: string }} [tags]
 */
export function recordHotspot(method, path, durationMs, tags) {
	// Strip query string if present
	const cleanPath = path.split('?')[0];
	const lookupKey = `${method.toUpperCase()} ${cleanPath}`;
	const key = hotspotLookup[lookupKey];
	if (!key) return; // not a hotspot endpoint

	// Aggregate
	const aggMetric = trendMap[`hs_${key}`];
	if (aggMetric) aggMetric.add(durationMs);

	if (!tags) return;

	// Includes dimension
	const inc = tags.includesLevel;
	if (inc && INCLUDES_LEVELS.includes(inc)) {
		const m = trendMap[`hs_${key}_inc_${inc}`];
		if (m) m.add(durationMs);
	}

	// Search mode dimension
	const sm = tags.searchMode;
	if (sm && SEARCH_MODES.includes(sm)) {
		const m = trendMap[`hs_${key}_search_${sm}`];
		if (m) m.add(durationMs);
	}

	// Page size dimension
	const ps = tags.pageSize;
	if (ps && PAGE_SIZE_BUCKETS.includes(String(ps))) {
		const m = trendMap[`hs_${key}_ps_${ps}`];
		if (m) m.add(durationMs);
	}
}

/**
 * Get the list of hotspot endpoint keys for documentation/debugging.
 * @returns {string[]}
 */
export function getHotspotKeys() {
	return Object.keys(hotspotLookup).map((k) => hotspotLookup[k]);
}
