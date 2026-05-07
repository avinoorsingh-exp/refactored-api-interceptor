/// <reference types="jest" />

/**
 * The `jest` meta-package does not list `@jest/globals` in `package.json` `exports`, so
 * TypeScript with `moduleResolution: "NodeNext"` cannot resolve that specifier. Jest still
 * provides the module at runtime (ESM + experimental VM modules). This declaration aligns
 * types with @types/jest globals.
 */
declare module '@jest/globals' {
	export const jest: Jest;
	export const describe: jest.Describe;
	export const it: jest.It;
	export const expect: jest.Expect;
	export const beforeEach: jest.Lifecycle;
	export const afterEach: jest.Lifecycle;
	export const beforeAll: jest.Lifecycle;
	export const afterAll: jest.Lifecycle;
}
