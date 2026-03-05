import { randomUUID } from 'crypto'
import type { RequestContext } from '../../src/async-context.storage.js'

/**
 * UUID v4 validation regex
 * Matches the standard UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, a, or b
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate if a string is a valid UUID v4
 * @param value - The string to validate
 * @returns true if the string matches UUID v4 format
 */
export function isValidUuidV4(value: string): boolean {
	return UUID_V4_REGEX.test(value)
}

/**
 * Generate a valid correlation ID (UUID v4)
 * @returns A valid UUID v4 correlation ID
 */
export function generateValidCorrelationId(): string {
	return randomUUID()
}

/**
 * Generate an invalid correlation ID (empty string)
 * @returns An empty string
 */
export function generateEmptyCorrelationId(): string {
	return ''
}

/**
 * Generate an invalid correlation ID (exceeds 100 characters)
 * @param length - The desired length (default: 101)
 * @returns A string longer than 100 characters
 */
export function generateLongCorrelationId(length = 101): string {
	return 'x'.repeat(length)
}

/**
 * Generate an invalid correlation ID containing newline character
 * @returns A string with a newline character
 */
export function generateCorrelationIdWithNewline(): string {
	return 'valid-id\ninjection-attempt'
}

/**
 * Generate an invalid correlation ID containing carriage return
 * @returns A string with a carriage return character
 */
export function generateCorrelationIdWithCarriageReturn(): string {
	return 'valid-id\rinjection-attempt'
}

/**
 * Generate a valid correlation ID at the maximum allowed length (100 characters)
 * @returns A 100-character string
 */
export function generateMaxLengthCorrelationId(): string {
	// Generate a valid string exactly 100 characters long
	return 'a'.repeat(100)
}

/**
 * Create a mock RequestContext for testing
 * @param overrides - Optional partial context to override defaults
 * @returns A complete RequestContext object
 */
export function createMockRequestContext(overrides?: Partial<RequestContext>): RequestContext {
	return {
		correlationId: generateValidCorrelationId(),
		timestamp: Date.now(),
		userId: 'test-user-123',
		requestPath: '/v1/test',
		method: 'GET',
		ip: '127.0.0.1',
		...overrides,
	}
}

/**
 * Create a minimal mock RequestContext with only required fields
 * @param correlationId - Optional correlation ID (generates one if not provided)
 * @returns A minimal RequestContext with only correlationId and timestamp
 */
export function createMinimalRequestContext(correlationId?: string): RequestContext {
	return {
		correlationId: correlationId || generateValidCorrelationId(),
		timestamp: Date.now(),
	}
}

/**
 * Generate a batch of unique correlation IDs
 * @param count - Number of correlation IDs to generate
 * @returns An array of unique UUID v4 correlation IDs
 */
export function generateUniqueCorrelationIds(count: number): string[] {
	const ids = new Set<string>()
	while (ids.size < count) {
		ids.add(generateValidCorrelationId())
	}
	return Array.from(ids)
}

/**
 * Validate that all items in an array are unique
 * @param items - Array of items to check
 * @returns true if all items are unique
 */
export function areAllUnique<T>(items: T[]): boolean {
	return new Set(items).size === items.length
}
