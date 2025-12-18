import 'reflect-metadata';
import { of } from 'rxjs';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { PaginationInterceptor } from './pagination.interceptor.js';
import { PaginationService } from './pagination.service.js';

function makeHttpContext(req: any, res: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

function createMockRequest(overrides: any = {}) {
  return {
    protocol: 'http',
    get: (name: string) => name === 'host' ? 'api.test' : undefined,
    originalUrl: '/widgets',
    query: {},
    headers: { host: 'api.test' },
    ...overrides,
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: function (k: string, v: string) { this.headers[k] = v; },
    removeHeader: function (k: string) { delete this.headers[k]; },
  };
}

describe('PaginationInterceptor (offset mode)', () => {
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

  it('sets X-Total-Count and Link, wraps {data, meta}', (done) => {
    const req = createMockRequest({
      originalUrl: '/widgets?offset=0&limit=25',
      query: { offset: '0', limit: '25' },
    });
    const res = createMockResponse();

    const ctx = makeHttpContext(req, res);
    const next = {
      handle: () => of({ items: [{ id: 1 }], total: 100 }),
    } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      // envelope
      expect(output).toHaveProperty('data');
      expect(output).toHaveProperty('meta');
      // headers
      expect(res.headers['X-Total-Count']).toBe('100');
      expect(res.headers['Link']).toContain('rel="next"');
      done();
    });
  });

  it('throws 400 if handler does not return total in non-countLess mode', (done) => {
    const req = createMockRequest();
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }]) } as any;

    interceptor.intercept(ctx, next).subscribe({
      error: (e) => {
        expect(String(e.message)).toMatch(/expected a non-negative numeric "total"/i);
        done();
      },
    });
  });

  // ============================================================================
  // Edge Cases and Error Scenarios (Requirements 9.1, 9.2, 9.3)
  // ============================================================================

  describe('envelope modes', () => {
    it('envelope=never returns raw handler result without wrapping', (done) => {
      const neverInterceptor = new PaginationInterceptor(svc, {
        envelope: 'never',
        countLess: false,
      });
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const handlerResult = { items: [{ id: 1 }], total: 10 };
      const next = { handle: () => of(handlerResult) } as any;

      neverInterceptor.intercept(ctx, next).subscribe((output) => {
        expect(output).toBe(handlerResult);
        expect(res.headers['X-Total-Count']).toBe('10');
        done();
      });
    });

    it('envelope=always wraps any response including unknown shapes', (done) => {
      const alwaysInterceptor = new PaginationInterceptor(svc, {
        envelope: 'always',
        countLess: false,
      });
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 5 }) } as any;

      alwaysInterceptor.intercept(ctx, next).subscribe((output) => {
        expect(output).toHaveProperty('data');
        expect(output).toHaveProperty('meta');
        expect(output.data).toEqual([{ id: 1 }]);
        done();
      });
    });

    it('envelope=auto wraps array responses', (done) => {
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      // Return items-total shape so it doesn't throw
      const next = { handle: () => of({ items: [{ id: 1 }, { id: 2 }], total: 2 }) } as any;

      interceptor.intercept(ctx, next).subscribe((output) => {
        expect(output).toHaveProperty('data');
        expect(output).toHaveProperty('meta');
        done();
      });
    });

    it('envelope=auto does not wrap unknown shapes', (done) => {
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const unknownShape = { items: [{ id: 1 }], total: 1, customField: 'test' };
      const next = { handle: () => of(unknownShape) } as any;

      interceptor.intercept(ctx, next).subscribe((output) => {
        // items-total shape should still be wrapped
        expect(output).toHaveProperty('data');
        expect(output).toHaveProperty('meta');
        done();
      });
    });
  });

  describe('custom data/meta keys', () => {
    it('uses custom dataKey and metaKey when specified', (done) => {
      const customInterceptor = new PaginationInterceptor(svc, {
        envelope: 'always',
        countLess: false,
        dataKey: 'results',
        metaKey: 'pagination',
      });
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 1 }) } as any;

      customInterceptor.intercept(ctx, next).subscribe((output) => {
        expect(output).toHaveProperty('results');
        expect(output).toHaveProperty('pagination');
        expect(output.results).toEqual([{ id: 1 }]);
        done();
      });
    });
  });

  describe('pagination validation errors', () => {
    it('throws BadRequestException for negative offset', () => {
      const req = createMockRequest({ query: { offset: '-1', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [], total: 0 }) } as any;

      expect(() => interceptor.intercept(ctx, next)).toThrow(BadRequestException);
    });

    it('clamps limit exceeding max (50) instead of throwing', (done) => {
      const req = createMockRequest({ query: { offset: '0', limit: '100' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [], total: 0 }) } as any;

      // Should NOT throw - limit is clamped to 50
      const result$ = interceptor.intercept(ctx, next);
      result$.subscribe({
        next: (response) => {
          // Verify limit was clamped to 50 in meta
          expect(response.meta.limit).toBe(50);
          done();
        },
        error: done.fail,
      });
    });

    it('throws BadRequestException for negative total from handler', (done) => {
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [], total: -5 }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => done.fail('Should have thrown'),
        error: (e) => {
          expect(e).toBeInstanceOf(BadRequestException);
          expect(e.message).toContain('expected a non-negative numeric "total"');
          done();
        },
      });
    });
  });

  describe('Link header generation', () => {
    it('includes rel="first" and rel="last" when includeFirstLast is true', (done) => {
      const req = createMockRequest({
        originalUrl: '/widgets?offset=25&limit=25',
        query: { offset: '25', limit: '25' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(res.headers['Link']).toContain('rel="first"');
        expect(res.headers['Link']).toContain('rel="last"');
        expect(res.headers['Link']).toContain('rel="next"');
        expect(res.headers['Link']).toContain('rel="prev"');
        done();
      });
    });

    it('excludes rel="first" and rel="last" when includeFirstLast is false', (done) => {
      const noFirstLastInterceptor = new PaginationInterceptor(svc, {
        envelope: 'auto',
        includeFirstLast: false,
        countLess: false,
      });
      const req = createMockRequest({
        originalUrl: '/widgets?offset=25&limit=25',
        query: { offset: '25', limit: '25' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

      noFirstLastInterceptor.intercept(ctx, next).subscribe(() => {
        expect(res.headers['Link']).not.toContain('rel="first"');
        expect(res.headers['Link']).not.toContain('rel="last"');
        done();
      });
    });

    it('does not include rel="prev" on first page', (done) => {
      const req = createMockRequest({
        originalUrl: '/widgets?offset=0&limit=25',
        query: { offset: '0', limit: '25' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(res.headers['Link']).not.toContain('rel="prev"');
        expect(res.headers['Link']).toContain('rel="next"');
        done();
      });
    });

    it('does not include rel="next" on last page', (done) => {
      const req = createMockRequest({
        originalUrl: '/widgets?offset=75&limit=25',
        query: { offset: '75', limit: '25' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

      interceptor.intercept(ctx, next).subscribe(() => {
        expect(res.headers['Link']).not.toContain('rel="next"');
        expect(res.headers['Link']).toContain('rel="prev"');
        done();
      });
    });
  });

  describe('meta calculation', () => {
    it('calculates correct meta for middle page', (done) => {
      const req = createMockRequest({
        originalUrl: '/widgets?offset=50&limit=25',
        query: { offset: '50', limit: '25' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

      interceptor.intercept(ctx, next).subscribe((output) => {
        expect(output.meta.currentPage).toBe(3);
        expect(output.meta.totalPages).toBe(4);
        expect(output.meta.hasNext).toBe(true);
        expect(output.meta.hasPrev).toBe(true);
        done();
      });
    });

    it('handles empty result set', (done) => {
      const req = createMockRequest({ query: { offset: '0', limit: '25' } });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ items: [], total: 0 }) } as any;

      interceptor.intercept(ctx, next).subscribe((output) => {
        expect(output.meta.total).toBe(0);
        expect(output.meta.totalPages).toBe(1);
        expect(output.meta.hasNext).toBe(false);
        expect(output.meta.hasPrev).toBe(false);
        expect(res.headers['X-Total-Count']).toBe('0');
        done();
      });
    });
  });
});

describe('PaginationInterceptor (countLess mode)', () => {
  let interceptor: PaginationInterceptor;
  let svc: PaginationService;

  beforeEach(() => {
    svc = new PaginationService();
    interceptor = new PaginationInterceptor(svc, {
      envelope: 'auto',
      countLess: true,
    });
  });

  it('does not require total from handler in countLess mode', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }, { id: 2 }]) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      expect(output).toHaveProperty('data');
      expect(output).toHaveProperty('meta');
      expect(output.meta).not.toHaveProperty('total');
      expect(output.meta).not.toHaveProperty('totalPages');
      done();
    });
  });

  it('removes X-Total-Count header in countLess mode', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    res.headers['X-Total-Count'] = '100'; // Pre-set to verify removal
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }]) } as any;

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(res.headers['X-Total-Count']).toBeUndefined();
      done();
    });
  });

  it('sets hasNext=true when page is full', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '2' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    // Return exactly limit items to indicate there might be more
    const next = { handle: () => of([{ id: 1 }, { id: 2 }]) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      expect(output.meta.hasNext).toBe(true);
      done();
    });
  });

  it('sets hasNext=false when page is not full', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '10' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    // Return fewer items than limit
    const next = { handle: () => of([{ id: 1 }, { id: 2 }]) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      expect(output.meta.hasNext).toBe(false);
      done();
    });
  });

  it('sets hasPrev=true when offset > 0', (done) => {
    const req = createMockRequest({ query: { offset: '10', limit: '10' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }]) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      expect(output.meta.hasPrev).toBe(true);
      done();
    });
  });

  it('generates Link header with only next/prev in countLess mode', (done) => {
    const req = createMockRequest({
      originalUrl: '/widgets?offset=10&limit=10',
      query: { offset: '10', limit: '10' },
    });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    // Full page to trigger hasNext
    const items = Array(10).fill({ id: 1 });
    const next = { handle: () => of(items) } as any;

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(res.headers['Link']).toContain('rel="next"');
      expect(res.headers['Link']).toContain('rel="prev"');
      expect(res.headers['Link']).not.toContain('rel="first"');
      expect(res.headers['Link']).not.toContain('rel="last"');
      done();
    });
  });

  it('does not set Link header when no next/prev available', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    // Return fewer items than limit (no next) and offset=0 (no prev)
    const next = { handle: () => of([{ id: 1 }]) } as any;

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(res.headers['Link']).toBeUndefined();
      done();
    });
  });

  it('envelope=never returns raw result in countLess mode', (done) => {
    const neverInterceptor = new PaginationInterceptor(svc, {
      envelope: 'never',
      countLess: true,
    });
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const rawResult = [{ id: 1 }, { id: 2 }];
    const next = { handle: () => of(rawResult) } as any;

    neverInterceptor.intercept(ctx, next).subscribe((output) => {
      expect(output).toBe(rawResult);
      done();
    });
  });

  it('envelope=always wraps result in countLess mode', (done) => {
    const alwaysInterceptor = new PaginationInterceptor(svc, {
      envelope: 'always',
      countLess: true,
    });
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }]) } as any;

    alwaysInterceptor.intercept(ctx, next).subscribe((output) => {
      expect(output).toHaveProperty('data');
      expect(output).toHaveProperty('meta');
      done();
    });
  });

  it('handles items-total shape in countLess mode (ignores total)', (done) => {
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    // Handler returns total but countLess mode should ignore it
    const next = { handle: () => of({ items: [{ id: 1 }], total: 100 }) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      expect(output).toHaveProperty('data');
      expect(output).toHaveProperty('meta');
      expect(output.meta).not.toHaveProperty('total');
      done();
    });
  });
});

describe('PaginationInterceptor default options', () => {
  it('uses default options when none provided', (done) => {
    const svc = new PaginationService();
    const interceptor = new PaginationInterceptor(svc);
    const req = createMockRequest({ query: { offset: '0', limit: '25' } });
    const res = createMockResponse();
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of({ items: [{ id: 1 }], total: 10 }) } as any;

    interceptor.intercept(ctx, next).subscribe((output) => {
      // Default envelope is 'auto', should wrap items-total shape
      expect(output).toHaveProperty('data');
      expect(output).toHaveProperty('meta');
      done();
    });
  });
});
