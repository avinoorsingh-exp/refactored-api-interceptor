/**
 * Test Utilities - NestJS Test Module Builder
 *
 * Simplifies creation of NestJS test modules with mocked dependencies.
 *
 * @example
 * ```typescript
 * import { createTestModule } from '../../../test/utils/test-module';
 * import { MyService } from './my.service';
 *
 * describe('MyService', () => {
 *   let service: MyService;
 *   let module: TestingModule;
 *
 *   beforeEach(async () => {
 *     const result = await createTestModule({
 *       providers: [MyService],
 *       mocks: {
 *         ConfigService: createMockConfigService(),
 *         LoggerService: createMockLogger(),
 *       },
 *     });
 *
 *     module = result.module;
 *     service = result.get(MyService);
 *   });
 *
 *   afterEach(async () => {
 *     await module.close();
 *   });
 * });
 * ```
 */

import { Test, type TestingModule } from '@nestjs/testing'
import type { Type, DynamicModule } from '@nestjs/common'

export interface TestModuleConfig {
	/**
	 * Providers to include in the test module
	 */
	providers?: Type<any>[]

	/**
	 * Controllers to include in the test module
	 */
	controllers?: Type<any>[]

	/**
	 * Imports (modules) to include
	 */
	imports?: (Type<any> | DynamicModule)[]

	/**
	 * Mock implementations for dependencies
	 * Key: Provider class or string token
	 * Value: Mock implementation (from jest-mock-extended)
	 */
	mocks?: Record<string, any>

	/**
	 * Exports to include
	 */
	exports?: (Type<any> | string)[]
}

export interface TestModuleResult {
	module: TestingModule
	get: <T>(provider: Type<T> | string) => T
	getMock: <T>(provider: Type<T> | string) => T
}

/**
 * Create a NestJS TestingModule with mocked dependencies
 *
 * @param config - Test module configuration
 * @returns TestModuleResult with module and helper methods
 *
 * @example
 * ```typescript
 * const { module, get, getMock } = await createTestModule({
 *   providers: [MyService, AnotherService],
 *   mocks: {
 *     ConfigService: createMockConfigService({ API_KEY: 'test' }),
 *     LoggerService: createMockLogger(),
 *   },
 * });
 *
 * const myService = get(MyService);
 * const mockConfig = getMock(ConfigService);
 * ```
 */
export async function createTestModule(
	config: TestModuleConfig,
): Promise<TestModuleResult> {
	const {
		providers = [],
		controllers = [],
		imports = [],
		mocks = {},
		exports = [],
	} = config

	// Build test module with mocked providers
	const moduleBuilder = Test.createTestingModule({
		imports,
		controllers,
		providers,
		exports,
	})

	// Override providers with mocks
	Object.entries(mocks).forEach(([token, mockImplementation]) => {
		moduleBuilder.overrideProvider(token).useValue(mockImplementation)
	})

	// Compile the module
	const module = await moduleBuilder.compile()

	return {
		module,
		get: <T>(provider: Type<T> | string): T => {
			return module.get<T>(provider)
		},
		getMock: <T>(provider: Type<T> | string): T => {
			return mocks[typeof provider === 'string' ? provider : provider.name] as T
		},
	}
}

/** Compile a minimal Nest testing module with provided providers. */
export async function createTestingModule(providers: any[]): Promise<TestingModule> {
	return Test.createTestingModule({ providers }).compile()
}

/**
 * Create a simple test context for services that don't need full NestJS DI
 *
 * @param Service - Service class to instantiate
 * @param dependencies - Constructor dependencies (mocked)
 * @returns Service instance
 *
 * @example
 * ```typescript
 * describe('MyService', () => {
 *   let service: MyService;
 *   let mockConfig: MockProxy<ConfigService>;
 *
 *   beforeEach(() => {
 *     mockConfig = createMockConfigService();
 *     service = createTestContext(MyService, [mockConfig]);
 *   });
 * });
 * ```
 */
export function createTestContext<T>(
	Service: new (...args: any[]) => T,
	dependencies: any[] = [],
): T {
	return new Service(...dependencies)
}

/**
 * Helper to extract provider from TestingModule
 *
 * @param module - TestingModule
 * @param provider - Provider class or token
 * @returns Provider instance
 */
export function getProvider<T>(module: TestingModule, provider: Type<T> | string): T {
	return module.get<T>(provider)
}

/**
 * Close and cleanup a test module
 *
 * @param module - TestingModule to close
 */
export async function closeTestModule(module: TestingModule): Promise<void> {
	if (module) {
		await module.close()
	}
}
