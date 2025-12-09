/**
 * Mock Factory Utilities for Agent-Service Tests
 *
 * Provides factory functions for creating mock objects used in unit tests.
 * These factories create consistent, type-safe mocks for repositories,
 * query builders, HTTP request/response objects, and execution contexts.
 *
 * @example
 * ```typescript
 * import { createMockRepository, createMockQueryBuilder } from '../../../test/utils/mock-factories';
 *
 * describe('MyService', () => {
 *   let mockRepo: ReturnType<typeof createMockRepository>;
 *
 *   beforeEach(() => {
 *     mockRepo = createMockRepository();
 *   });
 * });
 * ```
 */

// Using generic types to avoid dependency on express/nestjs in root test folder
// These types are compatible with the actual types when used in service tests

export interface MockRequest {
	headers: Record<string, string>
	path: string
	method: string
	protocol: string
	originalUrl: string
	url: string
	baseUrl: string
	query: Record<string, any>
	params: Record<string, any>
	body: any
	get: jest.Mock
	header: jest.Mock
}

export interface MockResponse {
	status: jest.Mock
	json: jest.Mock
	send: jest.Mock
	setHeader: jest.Mock
	removeHeader: jest.Mock
	getHeader: jest.Mock
	header: jest.Mock
	end: jest.Mock
	redirect: jest.Mock
	type: jest.Mock
	contentType: jest.Mock
}

export interface MockExecutionContext {
	switchToHttp: jest.Mock
	getClass: jest.Mock
	getHandler: jest.Mock
	getArgs: jest.Mock
	getArgByIndex: jest.Mock
	switchToRpc: jest.Mock
	switchToWs: jest.Mock
	getType: jest.Mock
}

export interface MockCallHandler<T = any> {
	handle: jest.Mock
}

/**
 * Create a mock repository with standard CRUD operations.
 * All methods are Jest mock functions that can be configured per test.
 *
 * @returns Mock repository object with findById, findAll, findPage, create, update, delete methods
 *
 * @example
 * ```typescript
 * const mockRepo = createMockRepository();
 * mockRepo.findById.mockResolvedValue({ id: '1', name: 'Test' });
 * ```
 */
export function createMockRepository<T = any>() {
	return {
		findById: jest.fn<Promise<T | null>, [string]>(),
		findAll: jest.fn<Promise<{ items: T[]; total: number }>, [any]>(),
		findPage: jest.fn<Promise<{ items: T[]; total: number }>, [any]>(),
		create: jest.fn<Promise<T>, [any]>(),
		update: jest.fn<Promise<T>, [string, any]>(),
		delete: jest.fn<Promise<void>, [string]>(),
		findByCode: jest.fn<Promise<T | null>, [string]>(),
		findByName: jest.fn<Promise<T | null>, [string]>(),
		findByNormalizedName: jest.fn<Promise<T | null>, [string]>(),
		findByRegionId: jest.fn<Promise<T[]>, [string]>(),
		upsert: jest.fn<Promise<T>, [any]>(),
	}
}

/**
 * Create a mock TypeORM SelectQueryBuilder with chainable methods.
 * All methods return `this` for chaining, except terminal methods.
 *
 * @returns Mock query builder with common TypeORM query builder methods
 *
 * @example
 * ```typescript
 * const mockQb = createMockQueryBuilder();
 * mockQb.getManyAndCount.mockResolvedValue([[{ id: '1' }], 1]);
 * ```
 */
export function createMockQueryBuilder<T = any>() {
	const mockQb = {
		select: jest.fn().mockReturnThis(),
		addSelect: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		orWhere: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		addOrderBy: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		take: jest.fn().mockReturnThis(),
		leftJoin: jest.fn().mockReturnThis(),
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		innerJoin: jest.fn().mockReturnThis(),
		innerJoinAndSelect: jest.fn().mockReturnThis(),
		setParameter: jest.fn().mockReturnThis(),
		setParameters: jest.fn().mockReturnThis(),
		getMany: jest.fn<Promise<T[]>, []>().mockResolvedValue([]),
		getOne: jest.fn<Promise<T | null>, []>().mockResolvedValue(null),
		getManyAndCount: jest.fn<Promise<[T[], number]>, []>().mockResolvedValue([[], 0]),
		getCount: jest.fn<Promise<number>, []>().mockResolvedValue(0),
		getRawMany: jest.fn<Promise<any[]>, []>().mockResolvedValue([]),
		getRawOne: jest.fn<Promise<any>, []>().mockResolvedValue(null),
		execute: jest.fn<Promise<any>, []>().mockResolvedValue(undefined),
	}
	return mockQb
}

/**
 * Create a mock Express Request object.
 * Provides common request properties and methods used in NestJS controllers.
 *
 * @param overrides - Optional partial request object to override defaults
 * @returns Mock request object
 *
 * @example
 * ```typescript
 * const mockReq = createMockRequest({
 *   headers: { 'x-correlation-id': 'test-123' },
 *   path: '/api/states',
 * });
 * ```
 */
export function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
	const headers: Record<string, string> = overrides.headers || {}

	return {
		headers,
		path: '/test',
		method: 'GET',
		protocol: 'http',
		originalUrl: '/test',
		url: '/test',
		baseUrl: '',
		query: {},
		params: {},
		body: {},
		get: jest.fn((name: string) => {
			if (name.toLowerCase() === 'host') return 'localhost:3000'
			return headers[name.toLowerCase()]
		}),
		header: jest.fn((name: string) => headers[name.toLowerCase()]),
		...overrides,
	}
}

/**
 * Create a mock Express Response object.
 * Provides common response methods used in NestJS controllers and filters.
 *
 * @returns Mock response object with chainable methods
 *
 * @example
 * ```typescript
 * const mockRes = createMockResponse();
 * mockRes.status(201).json({ id: '1' });
 * expect(mockRes.status).toHaveBeenCalledWith(201);
 * ```
 */
export function createMockResponse(): MockResponse {
	const headers: Record<string, string> = {}

	const mockRes: MockResponse = {
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
		send: jest.fn().mockReturnThis(),
		setHeader: jest.fn((name: string, value: string) => {
			headers[name.toLowerCase()] = value
			return mockRes
		}),
		removeHeader: jest.fn((name: string) => {
			delete headers[name.toLowerCase()]
			return mockRes
		}),
		getHeader: jest.fn((name: string) => headers[name.toLowerCase()]),
		header: jest.fn((name: string, value?: string) => {
			if (value !== undefined) {
				headers[name.toLowerCase()] = value
			}
			return mockRes
		}),
		end: jest.fn().mockReturnThis(),
		redirect: jest.fn().mockReturnThis(),
		type: jest.fn().mockReturnThis(),
		contentType: jest.fn().mockReturnThis(),
	}

	return mockRes
}

/**
 * Create a mock NestJS ExecutionContext.
 * Used for testing guards, interceptors, and pipes.
 *
 * @param request - Optional mock request object
 * @param response - Optional mock response object
 * @returns Mock execution context
 *
 * @example
 * ```typescript
 * const mockCtx = createMockExecutionContext(
 *   createMockRequest({ path: '/api/states' }),
 *   createMockResponse()
 * );
 * ```
 */
export function createMockExecutionContext(
	request: MockRequest = createMockRequest(),
	response: MockResponse = createMockResponse(),
): MockExecutionContext {
	return {
		switchToHttp: jest.fn().mockReturnValue({
			getRequest: jest.fn().mockReturnValue(request),
			getResponse: jest.fn().mockReturnValue(response),
			getNext: jest.fn(),
		}),
		getClass: jest.fn(),
		getHandler: jest.fn(),
		getArgs: jest.fn().mockReturnValue([request, response]),
		getArgByIndex: jest.fn(),
		switchToRpc: jest.fn(),
		switchToWs: jest.fn(),
		getType: jest.fn().mockReturnValue('http'),
	}
}

/**
 * Create a mock NestJS CallHandler for interceptor testing.
 * Returns an observable-like object that emits the provided data.
 *
 * @param data - Data to emit from the handler
 * @returns Mock call handler
 *
 * @example
 * ```typescript
 * const mockHandler = createMockCallHandler({ items: [], total: 0 });
 * const result = await interceptor.intercept(ctx, mockHandler).toPromise();
 * ```
 */
export function createMockCallHandler<T = any>(data: T): MockCallHandler<T> {
	// Create a simple observable-like object for testing
	const mockObservable = {
		pipe: jest.fn().mockReturnThis(),
		subscribe: jest.fn((observer: any) => {
			if (typeof observer === 'function') {
				observer(data)
			} else if (observer?.next) {
				observer.next(data)
				observer.complete?.()
			}
			return { unsubscribe: jest.fn() }
		}),
		toPromise: jest.fn().mockResolvedValue(data),
	}

	return {
		handle: jest.fn().mockReturnValue(mockObservable),
	}
}

/**
 * Create a mock TypeORM Repository.
 * Provides common repository methods used in TypeORM-based repositories.
 *
 * @returns Mock TypeORM repository
 *
 * @example
 * ```typescript
 * const mockTypeOrmRepo = createMockTypeOrmRepository();
 * mockTypeOrmRepo.findOne.mockResolvedValue({ id: '1', name: 'Test' });
 * ```
 */
export function createMockTypeOrmRepository<T = any>() {
	const mockQb = createMockQueryBuilder<T>()

	return {
		find: jest.fn<Promise<T[]>, [any?]>().mockResolvedValue([]),
		findOne: jest.fn<Promise<T | null>, [any]>().mockResolvedValue(null),
		findOneBy: jest.fn<Promise<T | null>, [any]>().mockResolvedValue(null),
		findBy: jest.fn<Promise<T[]>, [any]>().mockResolvedValue([]),
		save: jest.fn<Promise<T>, [any]>().mockImplementation((entity) => Promise.resolve(entity)),
		create: jest.fn<T, [any]>().mockImplementation((data) => data as T),
		update: jest.fn<Promise<any>, [any, any]>().mockResolvedValue({ affected: 1 }),
		delete: jest.fn<Promise<any>, [any]>().mockResolvedValue({ affected: 1 }),
		remove: jest.fn<Promise<T>, [T]>().mockImplementation((entity) => Promise.resolve(entity)),
		count: jest.fn<Promise<number>, [any?]>().mockResolvedValue(0),
		createQueryBuilder: jest.fn().mockReturnValue(mockQb),
		metadata: {
			columns: [],
			relations: [],
			tableName: 'mock_table',
		},
	}
}

/**
 * Create a mock QueryService for testing repositories.
 *
 * @returns Mock query service
 *
 * @example
 * ```typescript
 * const mockQueryService = createMockQueryService();
 * mockQueryService.normalize.mockReturnValue({ offset: 0, limit: 25 });
 * ```
 */
export function createMockQueryService() {
	return {
		normalize: jest.fn().mockReturnValue({
			offset: 0,
			limit: 25,
			filter: { conditions: [], logicalOperator: 'AND' },
			sort: { conditions: [] },
			search: { query: '', fields: [] },
		}),
		normalizeWithValidation: jest.fn().mockReturnValue({
			offset: 0,
			limit: 25,
			filter: { conditions: [], logicalOperator: 'AND' },
			sort: { conditions: [] },
			search: { query: '', fields: [] },
		}),
		applyFilters: jest.fn(),
		applySorting: jest.fn(),
		applySearch: jest.fn(),
		applyAll: jest.fn(),
		applyAllWithStrategies: jest.fn(),
		applyStrategySearch: jest.fn(),
	}
}

/**
 * Create a mock PaginationService for testing.
 *
 * @returns Mock pagination service
 *
 * @example
 * ```typescript
 * const mockPaginationService = createMockPaginationService();
 * mockPaginationService.buildMeta.mockReturnValue({ totalPages: 1, currentPage: 1 });
 * ```
 */
export function createMockPaginationService() {
	return {
		normalized: jest.fn().mockReturnValue({ offset: 0, limit: 25 }),
		buildMeta: jest.fn().mockReturnValue({
			totalPages: 1,
			currentPage: 1,
			hasNext: false,
			hasPrev: false,
			total: 0,
			offset: 0,
			limit: 25,
		}),
		buildLinkHeader: jest.fn().mockReturnValue(''),
	}
}

/**
 * Create a mock ProjectionService for testing.
 *
 * @returns Mock projection service
 */
export function createMockProjectionService() {
	return {
		applyProjection: jest.fn(),
		applyRelations: jest.fn(),
	}
}
