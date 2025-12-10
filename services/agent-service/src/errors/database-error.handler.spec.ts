import { ConflictException, BadRequestException } from '@nestjs/common'
import { DatabaseErrorHandler, DatabaseError } from './database-error.handler'

describe('DatabaseErrorHandler', () => {
	describe('isDatabaseError()', () => {
		it('should return true for PostgreSQL error code starting with 23', () => {
			const error = { code: '23505', message: 'duplicate key' }
			expect(DatabaseErrorHandler.isDatabaseError(error)).toBe(true)
		})

		it('should return true for foreign key violation code 23503', () => {
			const error = { code: '23503', message: 'foreign key violation' }
			expect(DatabaseErrorHandler.isDatabaseError(error)).toBe(true)
		})

		it('should return true for not null violation code 23502', () => {
			const error = { code: '23502', message: 'not null violation' }
			expect(DatabaseErrorHandler.isDatabaseError(error)).toBe(true)
		})

		it('should return false for non-database error', () => {
			const error = { message: 'generic error' }
			expect(DatabaseErrorHandler.isDatabaseError(error)).toBe(false)
		})

		it('should return false for error with non-23 code', () => {
			const error = { code: '42P01', message: 'undefined table' }
			expect(DatabaseErrorHandler.isDatabaseError(error)).toBe(false)
		})

		it('should return false for null error', () => {
			expect(DatabaseErrorHandler.isDatabaseError(null)).toBeFalsy()
		})

		it('should return false for undefined error', () => {
			expect(DatabaseErrorHandler.isDatabaseError(undefined)).toBeFalsy()
		})
	})

	describe('isUniqueViolation()', () => {
		it('should return true for code 23505', () => {
			const error = { code: '23505', constraint: 'users_email_key' }
			expect(DatabaseErrorHandler.isUniqueViolation(error)).toBe(true)
		})

		it('should return false for other database error codes', () => {
			const error = { code: '23503', constraint: 'users_role_fkey' }
			expect(DatabaseErrorHandler.isUniqueViolation(error)).toBe(false)
		})

		it('should return false for non-database error', () => {
			const error = { message: 'generic error' }
			expect(DatabaseErrorHandler.isUniqueViolation(error)).toBe(false)
		})
	})

	describe('isForeignKeyViolation()', () => {
		it('should return true for code 23503', () => {
			const error = { code: '23503', constraint: 'orders_user_fkey' }
			expect(DatabaseErrorHandler.isForeignKeyViolation(error)).toBe(true)
		})

		it('should return false for other database error codes', () => {
			const error = { code: '23505', constraint: 'users_email_key' }
			expect(DatabaseErrorHandler.isForeignKeyViolation(error)).toBe(false)
		})

		it('should return false for non-database error', () => {
			const error = { message: 'generic error' }
			expect(DatabaseErrorHandler.isForeignKeyViolation(error)).toBe(false)
		})
	})

	describe('isNotNullViolation()', () => {
		it('should return true for code 23502', () => {
			const error = { code: '23502', column: 'name' }
			expect(DatabaseErrorHandler.isNotNullViolation(error)).toBe(true)
		})

		it('should return false for other database error codes', () => {
			const error = { code: '23505', constraint: 'users_email_key' }
			expect(DatabaseErrorHandler.isNotNullViolation(error)).toBe(false)
		})
	})

	describe('extractFieldFromConstraint()', () => {
		it('should extract field from constraint with _key suffix', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('orders_email_key')).toBe('orders_email')
		})

		it('should extract field from constraint with _unique suffix', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('users_username_unique')).toBe('users_username')
		})

		it('should extract field from constraint with table name prefix', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('orders_email_key', 'orders')).toBe('email')
		})

		it('should extract field from constraint with _idx suffix', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('users_email_idx')).toBe('users_email')
		})

		it('should extract field from constraint with _pkey suffix', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('users_pkey')).toBe('users')
		})

		it('should return unknown for empty constraint name', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('')).toBe('unknown')
		})

		it('should handle constraint without common suffixes', () => {
			expect(DatabaseErrorHandler.extractFieldFromConstraint('custom_constraint')).toBe('custom_constraint')
		})
	})

	describe('extractValueFromDetail()', () => {
		it('should extract value from detail message', () => {
			const detail = 'Key (email)=(john@example.com) already exists.'
			expect(DatabaseErrorHandler.extractValueFromDetail(detail)).toBe('john@example.com')
		})

		it('should return null for detail without value pattern', () => {
			const detail = 'Some other error message'
			expect(DatabaseErrorHandler.extractValueFromDetail(detail)).toBeNull()
		})

		it('should extract numeric value', () => {
			const detail = 'Key (id)=(123) already exists.'
			expect(DatabaseErrorHandler.extractValueFromDetail(detail)).toBe('123')
		})
	})

	describe('extractCompositeFields()', () => {
		it('should extract composite key fields', () => {
			const detail = 'Key (listing_id, modification_timestamp)=(123, 2024-01-01) already exists.'
			expect(DatabaseErrorHandler.extractCompositeFields(detail)).toEqual([
				'listing_id',
				'modification_timestamp',
			])
		})

		it('should return empty array for non-composite key', () => {
			const detail = 'Some other error message'
			expect(DatabaseErrorHandler.extractCompositeFields(detail)).toEqual([])
		})

		it('should extract single field', () => {
			const detail = 'Key (email)=(test@example.com) already exists.'
			expect(DatabaseErrorHandler.extractCompositeFields(detail)).toEqual(['email'])
		})
	})

	describe('createFriendlyMessage()', () => {
		it('should create message for unique violation with value', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'duplicate key',
				code: '23505',
				constraint: 'users_email_key',
				detail: 'Key (email)=(john@example.com) already exists.',
				table: 'users',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe(
				"A record with email 'john@example.com' already exists",
			)
		})

		it('should create message for unique violation without value', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'duplicate key',
				code: '23505',
				constraint: 'users_email_key',
				table: 'users',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe('A record with this email already exists')
		})

		it('should create message for foreign key violation', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'foreign key violation',
				code: '23503',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe('Referenced record does not exist')
		})

		it('should create message for not null violation with column', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'not null violation',
				code: '23502',
				column: 'name',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe('name is required')
		})

		it('should create message for not null violation without column', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'not null violation',
				code: '23502',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe('field is required')
		})

		it('should create generic message for unknown database error', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'unknown error',
				code: '23000',
			}
			expect(DatabaseErrorHandler.createFriendlyMessage(error)).toBe('Database constraint violation')
		})
	})

	describe('toHttpException()', () => {
		it('should return ConflictException for unique violation', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'duplicate key',
				code: '23505',
				constraint: 'users_email_key',
				table: 'users',
			}
			const exception = DatabaseErrorHandler.toHttpException(error)
			expect(exception).toBeInstanceOf(ConflictException)
		})

		it('should return BadRequestException for foreign key violation', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'foreign key violation',
				code: '23503',
				constraint: 'orders_user_fkey',
				table: 'orders',
			}
			const exception = DatabaseErrorHandler.toHttpException(error)
			expect(exception).toBeInstanceOf(BadRequestException)
		})

		it('should return BadRequestException for not null violation', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'not null violation',
				code: '23502',
				column: 'name',
			}
			const exception = DatabaseErrorHandler.toHttpException(error)
			expect(exception).toBeInstanceOf(BadRequestException)
		})

		it('should return original error for unknown database error', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'unknown error',
				code: '23000',
			}
			const result = DatabaseErrorHandler.toHttpException(error)
			expect(result).toBe(error)
		})

		it('should include details in ConflictException response', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'duplicate key',
				code: '23505',
				constraint: 'users_email_key',
				table: 'users',
			}
			const exception = DatabaseErrorHandler.toHttpException(error) as ConflictException
			const response = exception.getResponse() as any
			expect(response.details).toEqual({
				code: '23505',
				constraint: 'users_email_key',
				table: 'users',
			})
		})

		it('should include details in BadRequestException response', () => {
			const error: DatabaseError = {
				name: 'QueryFailedError',
				message: 'foreign key violation',
				code: '23503',
				constraint: 'orders_user_fkey',
				table: 'orders',
			}
			const exception = DatabaseErrorHandler.toHttpException(error) as BadRequestException
			const response = exception.getResponse() as any
			expect(response.details).toEqual({
				code: '23503',
				constraint: 'orders_user_fkey',
				table: 'orders',
			})
		})
	})
})


// ============================================================================
// Property-Based Tests
// ============================================================================
import * as fc from 'fast-check'
import {
	postgresErrorCodes,
	constraintNameArbitrary,
} from '../../../../test/utils/generators'

describe('DatabaseErrorHandler - Property-Based Tests', () => {
	/**
	 * **Feature: agent-service-coverage, Property 20: DatabaseErrorHandler Error Detection**
	 * *For any* PostgreSQL error with code starting with '23', DatabaseErrorHandler.isDatabaseError SHALL return true.
	 * **Validates: Requirements 10.1**
	 */
	describe('Property 20: DatabaseErrorHandler Error Detection', () => {
		it('should return true for any error with code starting with 23', () => {
			// Generate any 5-digit code starting with 23
			const postgres23CodeArbitrary = fc
				.array(fc.constantFrom(...'0123456789'.split('')), { minLength: 3, maxLength: 3 })
				.map((digits) => '23' + digits.join(''))

			fc.assert(
				fc.property(postgres23CodeArbitrary, (code) => {
					const error = { code, message: 'test error' }
					return DatabaseErrorHandler.isDatabaseError(error) === true
				}),
				{ numRuns: 100 },
			)
		})

		it('should return false for any error with code not starting with 23', () => {
			// Generate codes that don't start with 23
			const nonPostgres23CodeArbitrary = fc
				.tuple(
					fc.constantFrom(...'01345678'.split('')), // First digit not 2
					fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: 4, maxLength: 4 }),
				)
				.map(([first, rest]) => first + rest.join(''))

			fc.assert(
				fc.property(nonPostgres23CodeArbitrary, (code) => {
					const error = { code, message: 'test error' }
					return DatabaseErrorHandler.isDatabaseError(error) === false
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 21: DatabaseErrorHandler Exception Mapping**
	 * *For any* unique violation (23505), DatabaseErrorHandler.toHttpException SHALL return ConflictException;
	 * for foreign key (23503) or not null (23502) violations, it SHALL return BadRequestException.
	 * **Validates: Requirements 10.4**
	 */
	describe('Property 21: DatabaseErrorHandler Exception Mapping', () => {
		it('should return ConflictException for any unique violation error', () => {
			const uniqueViolationArbitrary = fc.record({
				name: fc.constant('QueryFailedError'),
				message: fc.string({ minLength: 1, maxLength: 100 }),
				code: fc.constant(postgresErrorCodes.uniqueViolation),
				constraint: constraintNameArbitrary,
				table: fc.constantFrom('states', 'companies', 'regions', 'pay_plans'),
			})

			fc.assert(
				fc.property(uniqueViolationArbitrary, (error) => {
					const exception = DatabaseErrorHandler.toHttpException(error as DatabaseError)
					return exception instanceof ConflictException
				}),
				{ numRuns: 100 },
			)
		})

		it('should return BadRequestException for any foreign key violation error', () => {
			const foreignKeyViolationArbitrary = fc.record({
				name: fc.constant('QueryFailedError'),
				message: fc.string({ minLength: 1, maxLength: 100 }),
				code: fc.constant(postgresErrorCodes.foreignKeyViolation),
				constraint: constraintNameArbitrary,
				table: fc.constantFrom('states', 'companies', 'regions', 'pay_plans'),
			})

			fc.assert(
				fc.property(foreignKeyViolationArbitrary, (error) => {
					const exception = DatabaseErrorHandler.toHttpException(error as DatabaseError)
					return exception instanceof BadRequestException
				}),
				{ numRuns: 100 },
			)
		})

		it('should return BadRequestException for any not null violation error', () => {
			const notNullViolationArbitrary = fc.record({
				name: fc.constant('QueryFailedError'),
				message: fc.string({ minLength: 1, maxLength: 100 }),
				code: fc.constant(postgresErrorCodes.notNullViolation),
				column: fc.constantFrom('name', 'code', 'email', 'id'),
			})

			fc.assert(
				fc.property(notNullViolationArbitrary, (error) => {
					const exception = DatabaseErrorHandler.toHttpException(error as DatabaseError)
					return exception instanceof BadRequestException
				}),
				{ numRuns: 100 },
			)
		})
	})

	/**
	 * **Feature: agent-service-coverage, Property 22: DatabaseErrorHandler Constraint Field Extraction**
	 * *For any* constraint name following the pattern `{table}_{field}_key` or `{table}_{field}_unique`,
	 * extractFieldFromConstraint SHALL return the field name.
	 * **Validates: Requirements 10.5**
	 */
	describe('Property 22: DatabaseErrorHandler Constraint Field Extraction', () => {
		it('should extract field name from any constraint with _key suffix when table is provided', () => {
			const constraintWithKeyArbitrary = fc.tuple(
				fc.constantFrom('states', 'companies', 'regions', 'pay_plans', 'countries'),
				fc.constantFrom('name', 'code', 'email', 'id', 'username'),
			)

			fc.assert(
				fc.property(constraintWithKeyArbitrary, ([table, field]) => {
					const constraintName = `${table}_${field}_key`
					const extracted = DatabaseErrorHandler.extractFieldFromConstraint(constraintName, table)
					return extracted === field
				}),
				{ numRuns: 100 },
			)
		})

		it('should extract field name from any constraint with _unique suffix when table is provided', () => {
			const constraintWithUniqueArbitrary = fc.tuple(
				fc.constantFrom('states', 'companies', 'regions', 'pay_plans', 'countries'),
				fc.constantFrom('name', 'code', 'email', 'id', 'username'),
			)

			fc.assert(
				fc.property(constraintWithUniqueArbitrary, ([table, field]) => {
					const constraintName = `${table}_${field}_unique`
					const extracted = DatabaseErrorHandler.extractFieldFromConstraint(constraintName, table)
					return extracted === field
				}),
				{ numRuns: 100 },
			)
		})

		it('should return unknown for empty constraint name', () => {
			fc.assert(
				fc.property(fc.constant(''), (constraintName) => {
					const extracted = DatabaseErrorHandler.extractFieldFromConstraint(constraintName)
					return extracted === 'unknown'
				}),
				{ numRuns: 1 },
			)
		})
	})
})
