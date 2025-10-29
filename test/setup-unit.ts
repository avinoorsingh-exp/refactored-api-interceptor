/**
 * Global setup for unit tests
 *
 * This file is loaded before all unit tests run.
 * Configure global test environment, matchers, and utilities here.
 */

// Extend Jest matchers (if using @nestjs/testing or custom matchers)
// import '@testing-library/jest-dom';

// Set default test timeout
jest.setTimeout(10000)

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	// Keep error for debugging test failures
	error: console.error,
}

// Global beforeEach - reset all mocks
beforeEach(() => {
	jest.clearAllMocks()
})

// Global afterEach - cleanup
afterEach(() => {
	jest.restoreAllMocks()
})
