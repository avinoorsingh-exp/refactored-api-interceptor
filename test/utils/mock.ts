/**
 * Test Utilities - Mocking Helpers
 *
 * Centralized mocking utilities using jest-mock-extended for type-safe mocks.
 *
 * @example
 * ```typescript
 * import { mockDeep, mockReset } from 'jest-mock-extended';
 * import { createMockConfigService } from '../../../test/utils/mock';
 *
 * describe('MyService', () => {
 *   let configService: MockProxy<ConfigService>;
 *
 *   beforeEach(() => {
 *     configService = createMockConfigService({
 *       BATCHDATA_TOKEN: 'test-token',
 *       NODE_ENV: 'test',
 *     });
 *   });
 * });
 * ```
 */

import {
	mock,
	mockDeep,
	mockReset,
	type DeepMockProxy,
	type MockProxy,
} from 'jest-mock-extended'

/**
 * Re-export jest-mock-extended utilities for convenience
 */
export { mock, mockDeep, mockReset }
export type { DeepMockProxy, MockProxy }

/** Create a deep, type-safe mock for any class/interface. */
export const createMock = <T>() => mockDeep<T>()
export type MockOf<T> = DeepMockProxy<T>

/**
 * Create a mock ConfigService with default config values
 *
 * @param overrides - Optional config overrides
 * @returns MockProxy<ConfigService> with get() and getAll() methods
 *
 * @example
 * ```typescript
 * const config = createMockConfigService({
 *   BATCHDATA_TOKEN: 'test-token',
 *   BATCHDATA_TIMEOUT: 5000,
 * });
 *
 * expect(config.get('BATCHDATA_TOKEN')).toBe('test-token');
 * ```
 */
export function createMockConfigService<T extends Record<string, any>>(
	overrides: Partial<T> = {},
): MockProxy<any> {
	const defaultConfig = {
		NODE_ENV: 'test',
		LOG_LEVEL: 'silent',
		LOG_DIR: '/tmp/logs',
		...overrides,
	}

	const mockConfig = mock<any>()

	// Mock get() method
	mockConfig.get.mockImplementation((key: string) => {
		return defaultConfig[key as keyof typeof defaultConfig]
	})

	// Mock getAll() method
	mockConfig.getAll.mockReturnValue(defaultConfig)

	return mockConfig
}

/**
 * Create a mock LoggerService that doesn't log during tests
 *
 * @returns MockProxy<LoggerService> with all log methods mocked
 *
 * @example
 * ```typescript
 * const logger = createMockLogger();
 *
 * logger.info('test message', { meta: 'data' });
 * expect(logger.info).toHaveBeenCalledWith('test message', { meta: 'data' });
 * ```
 */
export function createMockLogger(): MockProxy<any> {
	const mockLogger = mock<any>()

	// Mock all log methods
	mockLogger.log.mockImplementation(() => {})
	mockLogger.info.mockImplementation(() => {})
	mockLogger.warn.mockImplementation(() => {})
	mockLogger.error.mockImplementation(() => {})
	mockLogger.debug.mockImplementation(() => {})
	mockLogger.providerCall.mockImplementation(() => {})

	return mockLogger
}

/**
 * Create a mock AxiosInstance for testing HTTP clients
 *
 * @returns MockProxy with request, get, post, put, delete, patch methods
 *
 * @example
 * ```typescript
 * const http = createMockAxios();
 *
 * http.post.mockResolvedValue({
 *   data: { result: 'success' },
 *   status: 200,
 *   statusText: 'OK',
 *   headers: {},
 *   config: {},
 * });
 * ```
 */
export function createMockAxios(): MockProxy<any> {
	const mockAxios = mock<any>()

	// Mock HTTP methods
	mockAxios.get.mockResolvedValue({ data: {}, status: 200 })
	mockAxios.post.mockResolvedValue({ data: {}, status: 201 })
	mockAxios.put.mockResolvedValue({ data: {}, status: 200 })
	mockAxios.patch.mockResolvedValue({ data: {}, status: 200 })
	mockAxios.delete.mockResolvedValue({ data: {}, status: 204 })
	mockAxios.request.mockResolvedValue({ data: {}, status: 200 })

	// Mock interceptors
	mockAxios.interceptors = {
		request: { use: jest.fn(), eject: jest.fn() },
		response: { use: jest.fn(), eject: jest.fn() },
	}

	return mockAxios
}

/**
 * Reset all mocks in an object
 *
 * @param mocks - Object containing MockProxy instances
 *
 * @example
 * ```typescript
 * const mocks = { config: mockDeep(), logger: mockDeep() };
 *
 * afterEach(() => {
 *   resetMocks(mocks);
 * });
 * ```
 */
export function resetMocks(mocks: Record<string, any>): void {
	Object.values(mocks).forEach((mock) => {
		if (mock && typeof mock === 'object' && 'mockReset' in mock) {
			mockReset(mock)
		}
	})
}
