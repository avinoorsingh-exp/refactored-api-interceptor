/**
 * Property-Based Tests for PaginationInterceptor
 *
 * **Feature: agent-service-coverage, Property 19: PaginationInterceptor Header Generation**
 * **Validates: Requirements 9.1, 9.2**
 *
 * Tests that for any paginated response with items and total, PaginationInterceptor
 * SHALL set X-Total-Count header and generate Link header with appropriate pagination links.
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { PaginationInterceptor } from './pagination.interceptor.js';
import { PaginationService } from './pagination.service.js';

function makeHttpContext(req: any, res: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

function createMockRequest(offset: number, limit: number) {
  return {
    protocol: 'http',
    get: (name: string) => (name === 'host' ? 'api.test' : undefined),
    originalUrl: `/items?offset=${offset}&limit=${limit}`,
    query: { offset: String(offset), limit: String(limit) },
    headers: { host: 'api.test' },
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: function (k: string, v: string) {
      this.headers[k] = v;
    },
    removeHeader: function (k: string) {
      delete this.headers[k];
    },
  };
}

describe('PaginationInterceptor Property Tests', () => {
  let interceptor: PaginationInterceptor;
  let svc: PaginationService;

  beforeEach(() => {
    svc = new PaginationService();
    interceptor = new PaginationInterceptor(svc, {
      envelope: 'auto',
      includeFirstLast: true,
      countLess: false,
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 19: PaginationInterceptor Header Generation**
   * **Validates: Requirements 9.1, 9.2**
   *
   * For any paginated response with items and total, PaginationInterceptor SHALL set
   * X-Total-Count header and generate Link header with appropriate pagination links.
   */
  describe('Property 19: PaginationInterceptor Header Generation', () => {
    it('should set X-Total-Count header equal to total for any valid pagination', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // offset
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 0, max: 100000 }), // total
          fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 50 }), // items
          (offset, limit, total, items) => {
            const req = createMockRequest(offset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let headerSet = false;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                // X-Total-Count should be set to the total value
                expect(res.headers['X-Total-Count']).toBe(String(total));
                headerSet = true;
              },
              error: (e) => {
                throw e;
              },
            });

            return headerSet;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should generate Link header with rel="next" when hasNext is true', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9000 }), // offset (not at end)
          fc.integer({ min: 1, max: 50 }), // limit
          fc.nat({ max: 100000 }), // total
          (offset, limit, totalBase) => {
            // Ensure total > offset + limit so hasNext is true
            const total = Math.max(totalBase, offset + limit + 1);
            const items = Array(Math.min(limit, total - offset))
              .fill(null)
              .map((_, i) => ({ id: String(i) }));

            const req = createMockRequest(offset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let linkContainsNext = false;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'] || '';
                linkContainsNext = link.includes('rel="next"');
              },
            });

            return linkContainsNext;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should generate Link header with rel="prev" when offset > 0', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }), // offset > 0
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 1, max: 100000 }), // total (at least 1)
          (offset, limit, total) => {
            const items = [{ id: '1' }];
            const req = createMockRequest(offset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let linkContainsPrev = false;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'] || '';
                linkContainsPrev = link.includes('rel="prev"');
              },
            });

            return linkContainsPrev;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should NOT include rel="next" when on last page', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 1, max: 1000 }), // total
          (limit, total) => {
            // Calculate offset to be on the last page
            const lastPageOffset = Math.max(0, Math.floor((total - 1) / limit) * limit);
            const items = Array(Math.min(limit, total - lastPageOffset))
              .fill(null)
              .map((_, i) => ({ id: String(i) }));

            const req = createMockRequest(lastPageOffset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let linkDoesNotContainNext = true;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'] || '';
                // On last page, should not have next
                linkDoesNotContainNext = !link.includes('rel="next"');
              },
            });

            return linkDoesNotContainNext;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should NOT include rel="prev" when offset is 0', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 0, max: 100000 }), // total
          (limit, total) => {
            const items = [{ id: '1' }];
            const req = createMockRequest(0, limit); // offset = 0
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let linkDoesNotContainPrev = true;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'] || '';
                linkDoesNotContainPrev = !link.includes('rel="prev"');
              },
            });

            return linkDoesNotContainPrev;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should include rel="first" and rel="last" when includeFirstLast is true', (done) => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // offset
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 1, max: 100000 }), // total (at least 1 to have pages)
          (offset, limit, total) => {
            const items = [{ id: '1' }];
            const req = createMockRequest(offset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let hasFirstAndLast = false;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'] || '';
                hasFirstAndLast = link.includes('rel="first"') && link.includes('rel="last"');
              },
            });

            return hasFirstAndLast;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });

    it('should produce RFC 8288 compliant Link header format', (done) => {
      // RFC 8288 format: <URL>; rel="relation", <URL>; rel="relation"
      const linkHeaderPattern = /^(<[^>]+>;\s*rel="[^"]+",?\s*)+$/;

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9000 }), // offset > 0 to ensure prev link
          fc.integer({ min: 1, max: 50 }), // limit
          fc.integer({ min: 10000, max: 100000 }), // total large enough to ensure next link
          (offset, limit, total) => {
            const items = [{ id: '1' }];
            const req = createMockRequest(offset, limit);
            const res = createMockResponse();
            const ctx = makeHttpContext(req, res);
            const next = { handle: () => of({ items, total }) } as any;

            let isValidFormat = false;
            interceptor.intercept(ctx, next).subscribe({
              next: () => {
                const link = res.headers['Link'];
                if (link) {
                  // Check that each link segment follows RFC 8288 format
                  const segments = link.split(',').map((s: string) => s.trim());
                  isValidFormat = segments.every((segment: string) => {
                    // Each segment should be <URL>; rel="relation"
                    return /^<[^>]+>;\s*rel="[^"]+"$/.test(segment);
                  });
                }
              },
            });

            return isValidFormat;
          },
        ),
        { numRuns: 100 },
      );
      done();
    });
  });
});
