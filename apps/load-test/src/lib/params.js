/**
 * Request parameter model and generators for k6 load tests.
 *
 * Provides configurable paging, search, filters, includes, and fields to
 * isolate performance issues in specific query patterns.
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
 *   FIELDS_MODE        — default|custom|mix (default: default)
 *   FIELDS_WEIGHTS     — default:70,custom:30 (default)
 *   FIELDS_COUNT_SET   — comma list of field counts for custom mode (default: 8,12,18)
 *
 * Module override pattern (keyed by uppercase module name):
 *   AGENTS_INCLUDES, AGENTS_FIELDS_MODE, AGENTS_FIELDS_COUNT_SET, etc.
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

/**
 * Pick N random unique elements from an array (Fisher-Yates partial shuffle).
 * @param {any[]} arr
 * @param {number} n
 * @returns {any[]}
 */
function randomSample(arr, n) {
	const copy = arr.slice();
	const count = Math.min(n, copy.length);
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(Math.random() * (copy.length - i));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy.slice(0, count);
}

/**
 * Get module-specific env var with fallback to global.
 * e.g. moduleEnv('agents', 'INCLUDES', 'none') checks AGENTS_INCLUDES first, then INCLUDES.
 * @param {string} module
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function moduleEnv(module, name, fallback) {
	const prefix = module.replace(/-/g, '_').toUpperCase();
	const moduleVal = __ENV[`${prefix}_${name}`];
	if (moduleVal && moduleVal.trim()) return moduleVal.trim();
	const globalVal = __ENV[name];
	if (globalVal && globalVal.trim()) return globalVal.trim();
	return fallback;
}

/**
 * Get module-specific env list with fallback to global.
 */
function moduleEnvList(module, name, fallback) {
	const raw = moduleEnv(module, name, fallback);
	return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Get module-specific env weights with fallback to global.
 */
function moduleEnvWeights(module, name, fallback) {
	const parts = moduleEnvList(module, name, fallback);
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

// ── Configuration ────────────────────────────────────────────────

const PAGE_SIZE_DEFAULT = parseInt(__ENV.PAGE_SIZE || '25', 10);
const PAGE_SIZE_SET = envList('PAGE_SIZE_SET', '10,25,50,100').map(Number);
const SEARCH_MODE = __ENV.SEARCH_MODE || 'prefix';
const SEARCH_TERMS = envList('SEARCH_TERMS', 'alice,bob,charlie,smith,jones');
const INCLUDES_MODE = __ENV.INCLUDES || 'none';
const INCLUDES_DIST = envWeights('INCLUDES_WEIGHTS', 'none:70,light:25,heavy:5');
const SEARCH_DIST = envWeights('SEARCH_WEIGHTS', 'prefix:60,contains:30,exact:10');
const FIELDS_MODE = __ENV.FIELDS_MODE || 'default';
const FIELDS_DIST = envWeights('FIELDS_WEIGHTS', 'default:70,custom:30');
const FIELDS_COUNT_SET = envList('FIELDS_COUNT_SET', '8,12,18').map(Number);

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

// ── Projections ─────────────────────────────────────────────────

/**
 * Load projections.json (generated by generate-projections.mjs).
 * Returns null if file is missing — params.js falls back to hardcoded maps.
 */
let _projections = null;
let _projectionsLoaded = false;

function loadProjections() {
	if (_projectionsLoaded) return _projections;
	_projectionsLoaded = true;
	try {
		// k6 open() reads files relative to the script, but we need a reliable path.
		// Use the open() function which is available at init time in k6.
		const raw = open('../generated/projections.json');
		_projections = JSON.parse(raw);
	} catch (_e) {
		// projections.json not found — fall back to hardcoded maps
		_projections = null;
	}
	return _projections;
}

// Load at init time (k6 requirement: open() must be called during init)
const PROJECTIONS = loadProjections();

// ── Includes mapping ─────────────────────────────────────────────

/**
 * Hardcoded fallback when projections.json is not available.
 */
const INCLUDES_MAP_FALLBACK = {
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

/**
 * Max relations to include for each level.
 * Prevents overly expensive queries.
 */
const INCLUDES_LIGHT_MAX = 2;
const INCLUDES_HEAVY_MAX = 5;

/**
 * Build includes value for a module + level using projection data.
 * Falls back to INCLUDES_MAP_FALLBACK if projections unavailable.
 *
 * @param {string} module
 * @param {string} level — 'none'|'light'|'heavy'
 * @returns {string}
 */
function buildIncludes(module, level) {
	if (level === 'none') return '';

	// Try projection-derived includes
	if (PROJECTIONS && PROJECTIONS[module]) {
		const relations = PROJECTIONS[module].relations;
		if (!relations || relations.length === 0) return '';

		if (level === 'light') {
			const count = Math.min(INCLUDES_LIGHT_MAX, Math.max(1, Math.ceil(relations.length * 0.15)));
			return randomSample(relations, count).join(',');
		}
		if (level === 'heavy') {
			const count = Math.min(INCLUDES_HEAVY_MAX, relations.length);
			return randomSample(relations, count).join(',');
		}
		return '';
	}

	// Fallback to hardcoded map
	return (INCLUDES_MAP_FALLBACK[module] || {})[level] || '';
}

/**
 * Build deterministic includes for smoke tests (projection-aware).
 * @param {string} module
 * @param {string} level
 * @returns {string}
 */
function buildSmokeIncludes(module, level) {
	if (level === 'none') return '';

	if (PROJECTIONS && PROJECTIONS[module]) {
		const relations = PROJECTIONS[module].relations;
		if (!relations || relations.length === 0) return '';

		if (level === 'light') {
			// Deterministic: first 1-2 relations
			return relations.slice(0, Math.min(INCLUDES_LIGHT_MAX, relations.length)).join(',');
		}
		if (level === 'heavy') {
			return relations.slice(0, Math.min(INCLUDES_HEAVY_MAX, relations.length)).join(',');
		}
		return '';
	}

	return (INCLUDES_MAP_FALLBACK[module] || {})[level] || '';
}

// ── Fields selection ─────────────────────────────────────────────

/**
 * Build a fields selection for custom mode.
 * Always includes required fields, then picks additional from allowed.
 *
 * @param {string} module
 * @param {number} targetCount — desired total fields count
 * @returns {{ mode: string, value: string, count: number } | null}
 */
function buildCustomFields(module, targetCount) {
	if (!PROJECTIONS || !PROJECTIONS[module]) return null;

	const { required, allowed } = PROJECTIONS[module];
	if (!allowed || allowed.length === 0) return null;

	// Always start with required fields
	const requiredSet = new Set(required || []);
	const nonRequired = allowed.filter((f) => !requiredSet.has(f));

	// Pick enough non-required fields to reach targetCount
	const additionalCount = Math.max(0, targetCount - requiredSet.size);
	const additional = randomSample(nonRequired, additionalCount);

	const selected = [...requiredSet, ...additional];
	return {
		mode: 'custom',
		value: selected.join(','),
		count: selected.length,
	};
}

/**
 * Build a deterministic fields selection for smoke tests.
 * @param {string} module
 * @param {number} targetCount
 * @returns {{ mode: string, value: string, count: number } | null}
 */
function buildSmokeCustomFields(module, targetCount) {
	if (!PROJECTIONS || !PROJECTIONS[module]) return null;

	const { required, allowed } = PROJECTIONS[module];
	if (!allowed || allowed.length === 0) return null;

	const requiredSet = new Set(required || []);
	const nonRequired = allowed.filter((f) => !requiredSet.has(f));

	// Deterministic: take the first N non-required fields
	const additionalCount = Math.max(0, targetCount - requiredSet.size);
	const additional = nonRequired.slice(0, additionalCount);

	const selected = [...requiredSet, ...additional];
	return {
		mode: 'custom',
		value: selected.join(','),
		count: selected.length,
	};
}

// ── Tag buckets ──────────────────────────────────────────────────

/**
 * Bucket an include count into a bounded set for tag cardinality.
 * Buckets: 0, 1, 2, 3, 5+
 * @param {number} count
 * @returns {string}
 */
function includeCountBucket(count) {
	if (count === 0) return '0';
	if (count <= 3) return String(count);
	return '5+';
}

/**
 * Bucket a fields count into a bounded set.
 * Buckets: 0, 5, 10, 15, 20+
 * @param {number} count
 * @returns {string}
 */
function fieldsCountBucket(count) {
	if (count === 0) return '0';
	if (count <= 5) return '5';
	if (count <= 10) return '10';
	if (count <= 15) return '15';
	return '20+';
}

// ── Public API ───────────────────────────────────────────────────

/**
 * @typedef {Object} RequestParams
 * @property {{ offset: number, limit: number }} paging
 * @property {{ term: string, mode: string, queryValue: string } | null} search
 * @property {Record<string, string>} filters
 * @property {{ level: string, value: string }} includes
 * @property {{ mode: string, value: string, count: number } | null} fields
 */

/**
 * Generate a fixed parameter set for smoke tests.
 * Deterministic: same values every iteration.
 *
 * @param {string} module — e.g. 'agents', 'companies'
 * @returns {RequestParams}
 */
export function smokeParams(module) {
	const includesMode = moduleEnv(module, 'INCLUDES', INCLUDES_MODE);
	const includesLevel = includesMode === 'mix' ? 'none' : includesMode;
	const includesValue = buildSmokeIncludes(module, includesLevel);

	// Fields
	const fieldsMode = moduleEnv(module, 'FIELDS_MODE', FIELDS_MODE);
	let fields = null;
	if (fieldsMode === 'custom') {
		const countSet = moduleEnvList(module, 'FIELDS_COUNT_SET', FIELDS_COUNT_SET.join(','));
		fields = buildSmokeCustomFields(module, parseInt(countSet[0], 10) || 8);
	}
	// 'mix' → use default for smoke; 'default' → null (omit fields=)

	return {
		paging: { offset: 0, limit: PAGE_SIZE_DEFAULT },
		search: null,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
		fields,
	};
}

/**
 * Generate a varied parameter set for baseline tests.
 * Weighted distribution of includes, search modes, and fields.
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

	// Includes: weighted selection with module override
	const includesMode = moduleEnv(module, 'INCLUDES', INCLUDES_MODE);
	const includesDist = moduleEnvWeights(module, 'INCLUDES_WEIGHTS', 'none:70,light:25,heavy:5');
	const includesLevel = includesMode === 'mix' ? weightedPick(includesDist) : includesMode;
	const includesValue = buildIncludes(module, includesLevel);

	// Fields: weighted selection with module override
	const fieldsMode = moduleEnv(module, 'FIELDS_MODE', FIELDS_MODE);
	const fieldsDist = moduleEnvWeights(module, 'FIELDS_WEIGHTS', 'default:70,custom:30');
	let fields = null;
	const effectiveFieldsMode = fieldsMode === 'mix' ? weightedPick(fieldsDist) : fieldsMode;
	if (effectiveFieldsMode === 'custom') {
		const countSet = moduleEnvList(module, 'FIELDS_COUNT_SET', FIELDS_COUNT_SET.join(',')).map(Number);
		const count = randomPick(countSet);
		fields = buildCustomFields(module, count);
	}

	return {
		paging: { offset, limit },
		search,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
		fields,
	};
}

/**
 * Generate worst-case parameter set for stress tests.
 * Focuses on contains search + heavy includes + large page size + custom fields.
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
	const includesMode = moduleEnv(module, 'INCLUDES', INCLUDES_MODE);
	const includesLevel = includesMode === 'mix' ? 'heavy' : includesMode;
	const includesValue = buildIncludes(module, includesLevel);

	// Fields: custom with large count for stress
	const fieldsMode = moduleEnv(module, 'FIELDS_MODE', FIELDS_MODE);
	let fields = null;
	const effectiveFieldsMode = fieldsMode === 'mix' ? 'custom' : fieldsMode;
	if (effectiveFieldsMode === 'custom') {
		const countSet = moduleEnvList(module, 'FIELDS_COUNT_SET', FIELDS_COUNT_SET.join(',')).map(Number);
		const count = countSet[countSet.length - 1] || 18;
		fields = buildCustomFields(module, count);
	}

	return {
		paging: { offset, limit },
		search,
		filters: STATIC_FILTERS,
		includes: { level: includesLevel, value: includesValue },
		fields,
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
 * Returns a string like "?offset=0&limit=25&search=alice&include=office&fields=id,name"
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

	// Fields
	if (params.fields && params.fields.value) {
		parts.push(`fields=${encodeURIComponent(params.fields.value)}`);
	}

	return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Build k6 tags that identify the parameter variant for this request.
 * Allows k6 output to show exactly which combination regressed.
 * All tags are bounded cardinality.
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

	// Include count bucket (bounded: 0/1/2/3/5+)
	if (params.includes && params.includes.value) {
		const count = params.includes.value.split(',').filter(Boolean).length;
		tags.includeCount = includeCountBucket(count);
	} else {
		tags.includeCount = '0';
	}

	// Has filters
	tags.hasFilters = params.filters && Object.keys(params.filters).length > 0 ? 'yes' : 'no';

	// Fields mode
	if (params.fields) {
		tags.fieldsMode = params.fields.mode;
		tags.fieldsCount = fieldsCountBucket(params.fields.count);
	} else {
		tags.fieldsMode = 'default';
		tags.fieldsCount = '0';
	}

	return tags;
}
