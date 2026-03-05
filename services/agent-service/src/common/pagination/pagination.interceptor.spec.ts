import 'reflect-metadata';
import { of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { PaginationInterceptor } from './pagination.interceptor.js';
import { PaginationService } from './pagination.service.js';

function makeHttpContext(req: any, res: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
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
    const req: any = {
      protocol: 'http',
      get: () => 'api.test',
      originalUrl: '/widgets?offset=0&limit=25',
      query: { offset: '0', limit: '25' },
      headers: { host: 'api.test' },
    };
    const res: any = {
      headers: {} as Record<string, string>,
      setHeader: function (k: string, v: string) { this.headers[k] = v; },
      removeHeader: function (k: string) { delete this.headers[k]; },
    };

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
    const req: any = {
      protocol: 'http',
      get: () => 'api.test',
      originalUrl: '/widgets',
      query: {},
    };
    const res: any = { setHeader() {}, removeHeader() {} };
    const ctx = makeHttpContext(req, res);
    const next = { handle: () => of([{ id: 1 }]) } as any;

    interceptor.intercept(ctx, next).subscribe({
      error: (e) => {
        expect(String(e.message)).toMatch(/expected a non-negative numeric "total"/i);
        done();
      },
    });
  });
});
