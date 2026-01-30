// Global test setup for API monitoring tests
// This file is run before all tests

// Mock @exprealty/cache module globally
jest.mock('@exprealty/cache', () => {
	const mockGetStore = jest.fn();
	const mockGetCorrelationId = jest.fn();

	return {
		AsyncContextStorage: {
			getStore: mockGetStore,
			getCorrelationId: mockGetCorrelationId,
		},
	};
});

