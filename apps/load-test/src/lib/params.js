/**
 * Request parameter model and generators for k6 load tests.
 *
 * Provides configurable paging, search, filters, and includes to isolate
 * performance issues in specific query patterns.
 *
 * All env vars are optional — safe defaults are used when missing.
 *
 * Environment variables:
 *   PAGE_SIZE          — default page size (default: 25)
 *   PAGE_SIZE_SET      — comma list for distribution (default: 10,25,50,100)
 *   SEARCH_MODE        — prefix|contains|exact|mix (default: prefix)
 *   SEARCH_TERMS       — comma list of terms (default: alice,bob,charlie,smith,jones)
 *   INCLUDES           — none|light|heavy|mix (default: none)
 *   FILTERS            — comma list key:value pairs (default: empty)
 *   INCLUDES_WEIGHTS   — none:70,light:25,heavy:5 (default)
 *   SEARCH_WEIGHTS     — prefix:60,contains:30,exact:10 (default)
 */

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Parse a comma-separated env var into an array.
 * @param {string} name
 * @param {string} fallback
 * @returns {string[]}
 */
function envList(name, fallback) {
	const v = __ENV[name];
	const raw = v && v.trim() ? v : fallback;
	return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a weighted distribution string: "a:70,b:25,c:5"
 * Returns array of { value, cumulativeWeight } for weighted random selection.
 * @param {string} name
 * @param {string} fallback
 * @returns {{ value: string, cumulativeWeight: number }[]}
 */
function envWeights(name, fallback) {
	const parts = envList(name, fallback);
	const items = [];
	let cumulative = 0;
	for (const part of parts) {
		const [value, w] = part.split(':');
		const weight = parseFloat(w) || 1;
		cumulative += weight;
		items.push({ value: value.trim(), cumulativeWeight: cumulative });
	}
	return items;
}

/**
 * Pick a value from a weighted distribution.
 * @param {{ value: string, cumulativeWeight: number }[]} distribution
 * @returns {string}
 */
function weightedPick(distribution) {
	const total = distribution[distribution.length - 1].cumulativeWeight;
	const r = Math.random() * total;
	for (const item of distribution) {
		if (r <= item.cumulativeWeight) return item.value;
	}
	return distribution[distribution.length - 1].value;
}

/**
 * Pick a random element from an array.
 * @param {any[]} arr
 * @returns {any}
 */
function randomPick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

// ── Configuration ────────────────────────────────────────────────

const PAGE_SIZE_DEFAULT = parseInt(__ENV.PAGE_SIZE || '25', 10);
const PAGE_SIZE_SET = envList('PAGE_SIZE_SET', '10,25,50,100').map(Number);
const SEARCH_MODE = __ENV.SEARCH_MODE || 'prefix';
const SEARCH_TERMS = envList('SEARCH_TERMS', 'alice,bob,charlie,smith,jones');
const INCLUDES_MODE = __ENV.INCLUDES || 'none';
const INCLUDES_DIST = envWeights('INCLUDES_WEIGHTS', 'none:70,light:25,heavy:5');
const SEARCH_DIST = envWeights('SEARCH_WEIGHTS', 'prefix:60,contains:30,exact:10');

/**
 * Parse FILTERS env var: "status:active,region:west" → { status: 'active', region: 'west' }
 * @returns {Record<string, string>}
 */
function parseFilters() {
	const raw = __ENV.FILTERS;
	if (!raw || !raw.trim()) return {};
	const filters = {};
	for (const pair of raw.split(',')) {
		const idx = pair.indexOf(':');
		if (idx > 0) {
			const key = pair.substring(0, idx).trim();
			const val = pair.substring(idx + 1).trim();
			if (key) filters[key] = val;
		}
	}
	return filters;
}

const STATIC_FILTERS = parseFilters();

// ── Includes mapping ─────────────────────────────────────────────

/**
 * Maps includes level to query params per module.
 *
 * 'none' — no includes
 * 'light' — small, commonly joined relations
 * 'heavy' — all available relations
 */
const INCLUDES_MAP = {
	agents: {
		none: '',
		light: 'office',
		heavy: 'mls,office,publicProfile',
	},
	companies: {
		none: '',
		light: '',
		heavy: '',
	},
	'agent-companies': {
		none: '',
		light: '',
		heavy: '',
	},
};

// ── Public API ───────────────────────────────────────────────────

/**
 * @typedef {Object} RequestParams
 * @property {{ offset: number, limit: number }} paging
 * @property {{ term: string, mode: string, queryValue: string } | null} search
 * @property {Record<string, string>} filters
 * @property {{ level: string, value: string }} includes
 */

/**
 * Generate a fixed parameter set for smoke tests.
 * Deterministic: same values every iteration.
 *
 * @param {string} module — e.g. 'agents', 'companies'
 * @returns {RequestParams}
 */
export function smokeParams(module) {
	const includesLevel = INCLUDES_MODE === 'mix' ? 'none' : INCLUDES_MODE;
	const includesValue = (INCLUDES_MAP[module] || {})[includesLevel] || '';

	return {
		paging: { offset: 0, limit: PAGE_SIZE_DEFAULT },
		search: null,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
	};
}

/**
 * Generate a varied parameter set for baseline tests.
 * Weighted distribution of includes and search modes.
 *
 * @param {string} module
 * @returns {RequestParams}
 */
export function baselineParams(module) {
	// Paging: pick from PAGE_SIZE_SET
	const limit = randomPick(PAGE_SIZE_SET);
	const offset = 0;

	// Search: weighted mode selection
	const searchMode = SEARCH_MODE === 'mix' ? weightedPick(SEARCH_DIST) : SEARCH_MODE;
	const term = randomPick(SEARCH_TERMS);
	const search = buildSearch(term, searchMode);

	// Includes: weighted selection
	const includesLevel = INCLUDES_MODE === 'mix' ? weightedPick(INCLUDES_DIST) : INCLUDES_MODE;
	const includesValue = (INCLUDES_MAP[module] || {})[includesLevel] || '';

	return {
		paging: { offset, limit },
		search,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
	};
}

/**
 * Generate worst-case parameter set for stress tests.
 * Focuses on contains search + heavy includes + large page size,
 * but still configurable via env vars.
 *
 * @param {string} module
 * @returns {RequestParams}
 */
export function stressParams(module) {
	// Paging: largest available or custom
	const limit = PAGE_SIZE_SET[PAGE_SIZE_SET.length - 1] || 100;
	const offset = 0;

	// Search: contains by default (worst-case for ILIKE), overridable
	const searchMode = SEARCH_MODE === 'mix' ? 'contains' : SEARCH_MODE;
	const term = randomPick(SEARCH_TERMS);
	const search = buildSearch(term, searchMode);

	// Includes: heavy by default, overridable
	const includesLevel = INCLUDES_MODE === 'mix' ? 'heavy' : INCLUDES_MODE;
	const includesValue = (INCLUDES_MAP[module] || {})[includesLevel] || '';

	return {
		paging: { offset, limit },
		search,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
	};
}

// ── Internals ────────────────────────────────────────────────────

/**
 * Build a search object with the appropriate ILIKE pattern.
 *
 * @param {string} term — raw search term
 * @param {string} mode — 'prefix'|'contains'|'exact'
 * @returns {{ term: string, mode: string, queryValue: string }}
 */
function buildSearch(term, mode) {
	let queryValue;
	switch (mode) {
		case 'contains':
			queryValue = term; // API handles ILIKE wrapping; we send the raw term
			break;
		case 'exact':
			queryValue = term;
			break;
		case 'prefix':
		default:
			queryValue = term;
			break;
	}
	return { term, mode, queryValue };
}

/**
 * Build query string parameters from a RequestParams object.
 * Returns a string like "?offset=0&limit=25&search=alice&include=office"
 *
 * @param {RequestParams} params
 * @returns {string}
 */
export function toQueryString(params) {
	const parts = [];

	// Paging
	if (params.paging) {
		parts.push(`offset=${params.paging.offset}`);
		parts.push(`limit=${params.paging.limit}`);
	}

	// Search
	if (params.search && params.search.queryValue) {
		parts.push(`search=${encodeURIComponent(params.search.queryValue)}`);
	}

	// Filters
	if (params.filters && Object.keys(params.filters).length > 0) {
		// Encode as filter JSON (matching API convention)
		parts.push(`filter=${encodeURIComponent(JSON.stringify(params.filters))}`);
	}

	// Includes
	if (params.includes && params.includes.value) {
		parts.push(`include=${encodeURIComponent(params.includes.value)}`);
	}

	return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Build k6 tags that identify the parameter variant for this request.
 * Allows k6 output to show exactly which combination regressed.
 *
 * @param {RequestParams} params
 * @returns {Record<string, string>}
 */
export function toTags(params) {
	const tags = {};

	// Page size bucket
	if (params.paging) {
		tags.pageSize = String(params.paging.limit);
	}

	// Search mode
	if (params.search) {
		tags.searchMode = params.search.mode;
	} else {
		tags.searchMode = 'none';
	}

	// Includes level
	if (params.includes) {
		tags.includesLevel = params.includes.level;
	}

	// Has filters
	tags.hasFilters = params.filters && Object.keys(params.filters).length > 0 ? 'yes' : 'no';

	return tags;
}
