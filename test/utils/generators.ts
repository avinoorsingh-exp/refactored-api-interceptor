/**
 * Data Generators for Property-Based Testing
 *
 * Provides fast-check arbitraries for generating test data used in property-based tests.
 * These generators create valid domain objects that conform to the application's schemas.
 *
 * @example
 * ```typescript
 * import * as fc from 'fast-check';
 * import { stateArbitrary, paginationArbitrary } from '../../../test/utils/generators';
 *
 * describe('StatesService', () => {
 *   it('should handle any valid state', () => {
 *     fc.assert(
 *       fc.property(stateArbitrary, (state) => {
 *         // Test with generated state
 *       }),
 *       { numRuns: 100 }
 *     );
 *   });
 * });
 * ```
 */

import * as fc from 'fast-check'

// ============================================================================
// Primitive Arbitraries
// ============================================================================

/**
 * Generate a valid UUID v4 string
 */
export const uuidArbitrary = fc.uuid()

/**
 * Generate a valid email address (max 255 chars)
 */
export const emailArbitrary = fc.emailAddress().filter((e) => e.length <= 255)

/**
 * Generate a non-empty string with length constraints
 */
export const nonEmptyStringArbitrary = (maxLength = 255) =>
	fc.string({ minLength: 1, maxLength }).filter((s) => s.trim().length > 0)

/**
 * Generate a 2-letter uppercase state code
 */
export const stateCodeArbitrary = fc
	.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
		minLength: 2,
		maxLength: 2,
	})
	.map((chars) => chars.join(''))

// ============================================================================
// Domain Entity Arbitraries
// ============================================================================

/**
 * Generate a valid State domain object
 */
export const stateArbitrary = fc.record({
	id: uuidArbitrary,
	name: nonEmptyStringArbitrary(100),
	code: stateCodeArbitrary,
	isActive: fc.boolean(),
	regionId: fc.integer({ min: 1, max: 1000 }).map(String),
	email: fc.option(emailArbitrary, { nil: undefined }),
	signatureDistributionEmail: fc.option(emailArbitrary, { nil: undefined }),
	countryId: fc.integer({ min: 1, max: 300 }),
})

/**
 * Generate a valid CreateState input
 */
export const createStateInputArbitrary = fc.record({
	name: nonEmptyStringArbitrary(100),
	code: stateCodeArbitrary,
	isActive: fc.boolean(),
	regionId: fc.integer({ min: 1, max: 1000 }).map(String),
	email: fc.option(emailArbitrary, { nil: undefined }),
	signatureDistributionEmail: fc.option(emailArbitrary, { nil: undefined }),
	countryId: fc.integer({ min: 1, max: 300 }),
})

/**
 * Generate a valid Company domain object
 */
export const companyArbitrary = fc.record({
	id: uuidArbitrary,
	name: nonEmptyStringArbitrary(255),
	email: emailArbitrary,
	createdAt: fc.date(),
	updatedAt: fc.date(),
})

/**
 * Generate a valid CreateCompany input
 */
export const createCompanyInputArbitrary = fc.record({
	name: fc.string({ minLength: 2, maxLength: 255 }).filter((s) => s.trim().length >= 2),
	email: emailArbitrary,
})

/**
 * Generate a valid Region domain object
 */
export const regionArbitrary = fc.record({
	id: fc.integer({ min: 1, max: 10000 }).map(String),
	name: nonEmptyStringArbitrary(255),
})

/**
 * Generate a valid CreateRegion input
 */
export const createRegionInputArbitrary = fc.record({
	name: nonEmptyStringArbitrary(255),
})

/**
 * Generate a valid PayPlan domain object
 */
export const payPlanArbitrary = fc.record({
	id: uuidArbitrary,
	name: nonEmptyStringArbitrary(255),
	active: fc.boolean(),
	agentPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
	cap: fc.float({ min: 0, max: 1000000, noNaN: true }),
})

/**
 * Generate a valid CreatePayPlan input
 */
export const createPayPlanInputArbitrary = fc.record({
	name: nonEmptyStringArbitrary(255),
	active: fc.boolean(),
	agentPercentage: fc.float({ min: 0, max: 100, noNaN: true }),
	cap: fc.float({ min: 0, max: 1000000, noNaN: true }),
})

/**
 * Generate a valid Country domain object
 */
export const countryArbitrary = fc.record({
	countryId: fc.integer({ min: 1, max: 300 }),
	name: nonEmptyStringArbitrary(100),
	twoLetterCode: fc
		.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
			minLength: 2,
			maxLength: 2,
		})
		.map((chars) => chars.join('')),
	iso3166: fc
		.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
			minLength: 3,
			maxLength: 3,
		})
		.map((chars) => chars.join('')),
	dialingCode: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
})

// ============================================================================
// Query Parameter Arbitraries
// ============================================================================

/**
 * Generate valid pagination parameters
 */
export const paginationArbitrary = fc.record({
	offset: fc.integer({ min: 0, max: 10000 }),
	limit: fc.integer({ min: 1, max: 50 }),
})

/**
 * Generate pagination with total for meta calculation testing
 */
export const paginationWithTotalArbitrary = fc.record({
	offset: fc.integer({ min: 0, max: 10000 }),
	limit: fc.integer({ min: 1, max: 50 }),
	total: fc.integer({ min: 0, max: 100000 }),
})

/**
 * Filter operators supported by QueryService
 */
export const filterOperators = [
	'eq',
	'ne',
	'gt',
	'gte',
	'lt',
	'lte',
	'like',
	'ilike',
	'in',
	'nin',
	'between',
	'isNull',
	'isNotNull',
	'contains',
	'startsWith',
	'endsWith',
] as const

export type FilterOperator = (typeof filterOperators)[number]

/**
 * Generate a valid filter operator
 */
export const filterOperatorArbitrary = fc.constantFrom(...filterOperators)

/**
 * Generate a valid filter condition
 */
export const filterConditionArbitrary = fc.record({
	field: fc.constantFrom('name', 'code', 'isActive', 'id', 'email', 'active'),
	operator: filterOperatorArbitrary,
	value: fc.oneof(
		fc.string({ minLength: 1, maxLength: 100 }),
		fc.integer({ min: -1000, max: 1000 }),
		fc.boolean(),
	),
})

/**
 * Generate a valid filter with multiple conditions
 */
export const filterArbitrary = fc.record({
	conditions: fc.array(filterConditionArbitrary, { minLength: 0, maxLength: 5 }),
	logicalOperator: fc.constantFrom('AND', 'OR'),
})

/**
 * Sort directions
 */
export const sortDirections = ['ASC', 'DESC'] as const
export type SortDirection = (typeof sortDirections)[number]

/**
 * Generate a valid sort condition
 */
export const sortConditionArbitrary = fc.record({
	field: fc.constantFrom('name', 'code', 'created', 'lastModified', 'id'),
	direction: fc.constantFrom<SortDirection>(...sortDirections),
})

/**
 * Generate a valid sort with multiple conditions
 */
export const sortArbitrary = fc.record({
	conditions: fc.array(sortConditionArbitrary, { minLength: 0, maxLength: 3 }),
})

/**
 * Generate a valid search query
 */
export const searchArbitrary = fc.record({
	query: fc.string({ minLength: 0, maxLength: 100 }),
	fields: fc.array(fc.constantFrom('name', 'code', 'email', 'id'), { minLength: 0, maxLength: 4 }),
})

/**
 * Generate complete normalized query parameters
 */
export const normalizedQueryParamsArbitrary = fc.record({
	offset: fc.integer({ min: 0, max: 10000 }),
	limit: fc.integer({ min: 1, max: 50 }),
	filter: filterArbitrary,
	sort: sortArbitrary,
	search: searchArbitrary,
})

// ============================================================================
// HTTP/Request Arbitraries
// ============================================================================

/**
 * Generate a valid HTTP method
 */
export const httpMethodArbitrary = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE')

/**
 * Generate a valid URL path
 */
export const urlPathArbitrary = fc
	.array(
		fc
			.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
				minLength: 1,
				maxLength: 20,
			})
			.map((chars) => chars.join('')),
		{
			minLength: 1,
			maxLength: 5,
		},
	)
	.map((segments) => '/' + segments.join('/'))

/**
 * Generate a valid correlation ID (UUID format)
 */
export const correlationIdArbitrary = uuidArbitrary

// ============================================================================
// Error/Exception Arbitraries
// ============================================================================

/**
 * PostgreSQL error codes for database error testing
 */
export const postgresErrorCodes = {
	uniqueViolation: '23505',
	foreignKeyViolation: '23503',
	notNullViolation: '23502',
	checkViolation: '23514',
} as const

/**
 * Generate a PostgreSQL error code
 */
export const postgresErrorCodeArbitrary = fc.constantFrom(
	postgresErrorCodes.uniqueViolation,
	postgresErrorCodes.foreignKeyViolation,
	postgresErrorCodes.notNullViolation,
	postgresErrorCodes.checkViolation,
)

/**
 * Generate a constraint name following PostgreSQL naming conventions
 */
export const constraintNameArbitrary = fc
	.tuple(
		fc.constantFrom('states', 'companies', 'regions', 'pay_plans', 'countries'),
		fc.constantFrom('name', 'code', 'email', 'id'),
		fc.constantFrom('key', 'unique', 'fkey', 'pkey'),
	)
	.map(([table, field, suffix]) => `${table}_${field}_${suffix}`)

// ============================================================================
// Validation Arbitraries
// ============================================================================

/**
 * Generate invalid email addresses for validation testing
 */
export const invalidEmailArbitrary = fc.oneof(
	fc.constant(''),
	fc.constant('notanemail'),
	fc.constant('@missing-local.com'),
	fc.constant('missing-domain@'),
	fc.constant('spaces in@email.com'),
)

/**
 * Generate whitespace-only strings for validation testing
 */
export const whitespaceOnlyArbitrary = fc
	.array(fc.constantFrom(' ', '\t', '\n', '\r'), {
		minLength: 1,
		maxLength: 10,
	})
	.map((chars) => chars.join(''))

/**
 * Generate invalid pagination values
 */
export const invalidPaginationArbitrary = fc.record({
	offset: fc.oneof(fc.integer({ min: -1000, max: -1 }), fc.constant(NaN)),
	limit: fc.oneof(
		fc.integer({ min: -1000, max: 0 }),
		fc.integer({ min: 51, max: 1000 }),
		fc.constant(NaN),
	),
})

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an arbitrary that generates arrays of a given arbitrary
 * with configurable length constraints
 */
export function arrayOf<T>(arbitrary: fc.Arbitrary<T>, minLength = 0, maxLength = 10) {
	return fc.array(arbitrary, { minLength, maxLength })
}

/**
 * Create an arbitrary that generates optional values
 */
export function optional<T>(arbitrary: fc.Arbitrary<T>) {
	return fc.option(arbitrary, { nil: undefined })
}

/**
 * Create an arbitrary that generates nullable values
 */
export function nullable<T>(arbitrary: fc.Arbitrary<T>) {
	return fc.option(arbitrary, { nil: null })
}
