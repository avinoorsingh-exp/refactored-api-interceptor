/**
 * Unit Tests for QueryMetadataInterceptor
 *
 * Tests query metadata attachment to response.
 * _Requirements: 9.5_
 */

import 'reflect-metadata';
import { of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { QueryMetadataInterceptor } from './query-metadata.interceptor.js';

function makeHttpContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

function createMockRequest(query: Record<string, any> = {}) {
  return {
    query,
  };
}

describe('QueryMetadataInterceptor', () => {
  let interceptor: QueryMetadataInterceptor;

  beforeEach(() => {
    interceptor = new QueryMetadataInterceptor();
  });

  describe('pagination metadata', () => {
    it('should include default pagination values when not provided', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.pagination).toEqual({
            offset: 0,
            limit: 25,
            page: undefined,
            pageSize: undefined,
          });
          done();
        },
      });
    });

    it('should parse offset and limit from query params', (done) => {
      const req = createMockRequest({ offset: '10', limit: '50' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.pagination.offset).toBe(10);
          expect(result.meta.query.pagination.limit).toBe(50);
          done();
        },
      });
    });

    it('should parse page and pageSize when provided', (done) => {
      const req = createMockRequest({ page: '2', pageSize: '20' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.pagination.page).toBe(2);
          expect(result.meta.query.pagination.pageSize).toBe(20);
          done();
        },
      });
    });
  });

  describe('search metadata', () => {
    it('should include search query when provided', (done) => {
      const req = createMockRequest({ search: 'test query' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.search).toBe('test query');
          done();
        },
      });
    });

    it('should not include search when not provided', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.search).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('filter metadata', () => {
    it('should parse JSON filter string', (done) => {
      const filter = { name: { eq: 'test' } };
      const req = createMockRequest({ filter: JSON.stringify(filter) });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.filter).toEqual(filter);
          done();
        },
      });
    });

    it('should handle filter as object directly', (done) => {
      const filter = { name: { eq: 'test' } };
      const req = createMockRequest({ filter });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.filter).toEqual(filter);
          done();
        },
      });
    });

    it('should handle invalid JSON filter gracefully', (done) => {
      const req = createMockRequest({ filter: 'invalid-json' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.filter).toBe('invalid-json');
          done();
        },
      });
    });

    it('should not include filter when not provided', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.filter).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('sort metadata', () => {
    it('should parse JSON sort string', (done) => {
      const sort = [{ field: 'name', direction: 'ASC' }];
      const req = createMockRequest({ sort: JSON.stringify(sort) });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.sort).toEqual(sort);
          done();
        },
      });
    });

    it('should handle simple sort string', (done) => {
      const req = createMockRequest({ sort: 'name:ASC' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.sort).toBe('name:ASC');
          done();
        },
      });
    });

    it('should handle sort as object directly', (done) => {
      const sort = [{ field: 'name', direction: 'DESC' }];
      const req = createMockRequest({ sort });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.sort).toEqual(sort);
          done();
        },
      });
    });

    it('should handle invalid JSON sort gracefully', (done) => {
      const req = createMockRequest({ sort: '{invalid' });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.sort).toBe('{invalid');
          done();
        },
      });
    });

    it('should not include sort when not provided', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.sort).toBeUndefined();
          done();
        },
      });
    });
  });

  describe('appliedAt timestamp', () => {
    it('should include appliedAt timestamp in ISO format', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          done();
        },
      });
    });
  });

  describe('response wrapping', () => {
    it('should wrap array responses with data and meta', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const items = [{ id: 1 }, { id: 2 }];
      const next = { handle: () => of(items) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('meta');
          expect(result.data).toEqual(items);
          expect(result.meta.count).toBe(2);
          done();
        },
      });
    });

    it('should handle items/total pattern from repository', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const repoResult = { items: [{ id: 1 }], total: 100 };
      const next = { handle: () => of(repoResult) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.data).toEqual([{ id: 1 }]);
          expect(result.meta.total).toBe(100);
          expect(result.meta.count).toBe(1);
          expect(result.meta.query).toBeDefined();
          done();
        },
      });
    });

    it('should merge query metadata into existing meta', (done) => {
      const req = createMockRequest({ search: 'test' });
      const ctx = makeHttpContext(req);
      const responseWithMeta = {
        data: [{ id: 1 }],
        meta: { total: 50, customField: 'value' },
      };
      const next = { handle: () => of(responseWithMeta) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.data).toEqual([{ id: 1 }]);
          expect(result.meta.total).toBe(50);
          expect(result.meta.customField).toBe('value');
          expect(result.meta.query).toBeDefined();
          expect(result.meta.query.search).toBe('test');
          done();
        },
      });
    });

    it('should pass through non-object responses unchanged', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of('string response') } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toBe('string response');
          done();
        },
      });
    });

    it('should pass through null responses unchanged', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of(null) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
      });
    });

    it('should pass through undefined responses unchanged', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const next = { handle: () => of(undefined) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toBeUndefined();
          done();
        },
      });
    });

    it('should handle object without items/total or meta pattern', (done) => {
      const req = createMockRequest({});
      const ctx = makeHttpContext(req);
      const customObject = { customField: 'value', anotherField: 123 };
      const next = { handle: () => of(customObject) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          // Should pass through unchanged since it doesn't match known patterns
          expect(result).toEqual(customObject);
          done();
        },
      });
    });
  });

  describe('complex query scenarios', () => {
    it('should handle all query params together', (done) => {
      const req = createMockRequest({
        offset: '20',
        limit: '10',
        page: '3',
        pageSize: '10',
        search: 'test search',
        filter: JSON.stringify({ status: { eq: 'active' } }),
        sort: JSON.stringify([{ field: 'name', direction: 'ASC' }]),
      });
      const ctx = makeHttpContext(req);
      const next = { handle: () => of([{ id: 1 }]) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta.query.pagination.offset).toBe(20);
          expect(result.meta.query.pagination.limit).toBe(10);
          expect(result.meta.query.pagination.page).toBe(3);
          expect(result.meta.query.pagination.pageSize).toBe(10);
          expect(result.meta.query.search).toBe('test search');
          expect(result.meta.query.filter).toEqual({ status: { eq: 'active' } });
          expect(result.meta.query.sort).toEqual([{ field: 'name', direction: 'ASC' }]);
          done();
        },
      });
    });
  });
});
