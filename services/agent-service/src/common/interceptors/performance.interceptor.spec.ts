/**
 * Unit Tests for PerformanceInterceptor
 *
 * Tests request timing logging functionality.
 * _Requirements: 9.4_
 */

import 'reflect-metadata';
import { of, throwError } from 'rxjs';
import { ExecutionContext, Logger } from '@nestjs/common';
import { PerformanceInterceptor } from './performance.interceptor.js';

function makeHttpContext(req: any, res: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function createMockRequest(overrides: any = {}) {
  return {
    method: 'GET',
    url: '/api/test',
    query: {},
    ...overrides,
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
  };
}

describe('PerformanceInterceptor', () => {
  let loggerWarnSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('default options', () => {
    it('should set X-Response-Time header on successful response', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(res.setHeader).toHaveBeenCalledWith(
            'X-Response-Time',
            expect.stringMatching(/^\d+ms$/),
          );
          done();
        },
      });
    });

    it('should set X-Query-Timestamp header on successful response', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(res.setHeader).toHaveBeenCalledWith(
            'X-Query-Timestamp',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          );
          done();
        },
      });
    });

    it('should not log queries by default (logAllQueries=false)', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerDebugSpy).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('slow query detection', () => {
    it('should log warning for queries exceeding threshold', (done) => {
      const interceptor = new PerformanceInterceptor({
        slowQueryThresholdMs: 0, // Set to 0 to always trigger
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            'Slow query detected',
            expect.objectContaining({
              endpoint: 'GET /api/test',
              method: 'GET',
              warning: expect.stringContaining('threshold'),
            }),
          );
          done();
        },
      });
    });

    it('should not log warning for fast queries', (done) => {
      const interceptor = new PerformanceInterceptor({
        slowQueryThresholdMs: 10000, // High threshold
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerWarnSpy).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('logAllQueries option', () => {
    it('should log debug for all queries when logAllQueries=true', (done) => {
      const interceptor = new PerformanceInterceptor({
        logAllQueries: true,
        slowQueryThresholdMs: 10000, // High threshold to avoid warn
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerDebugSpy).toHaveBeenCalledWith(
            'Query completed',
            expect.objectContaining({
              endpoint: 'GET /api/test',
              method: 'GET',
            }),
          );
          done();
        },
      });
    });
  });

  describe('includeInBody option', () => {
    it('should add performance to response body when includeInBody=true', (done) => {
      const interceptor = new PerformanceInterceptor({
        includeInBody: true,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const responseData = { data: 'test' };
      const next = { handle: () => of(responseData) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toHaveProperty('performance');
          expect(result.performance).toHaveProperty('durationMs');
          expect(result.performance).toHaveProperty('timestamp');
          done();
        },
      });
    });

    it('should add performance to meta when response has meta property', (done) => {
      const interceptor = new PerformanceInterceptor({
        includeInBody: true,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const responseData = { data: 'test', meta: { total: 10 } };
      const next = { handle: () => of(responseData) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result.meta).toHaveProperty('performance');
          expect(result.meta.performance).toHaveProperty('durationMs');
          expect(result.meta.performance).toHaveProperty('timestamp');
          expect(result.meta.total).toBe(10);
          done();
        },
      });
    });

    it('should not modify non-object responses', (done) => {
      const interceptor = new PerformanceInterceptor({
        includeInBody: true,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of('string response') } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toBe('string response');
          done();
        },
      });
    });

    it('should not modify null responses', (done) => {
      const interceptor = new PerformanceInterceptor({
        includeInBody: true,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of(null) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
      });
    });
  });

  describe('error handling', () => {
    it('should set headers even on error', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const error = new Error('Test error');
      (error as any).status = 500;
      const next = { handle: () => throwError(() => error) } as any;

      interceptor.intercept(ctx, next).subscribe({
        error: () => {
          expect(res.setHeader).toHaveBeenCalledWith(
            'X-Response-Time',
            expect.stringMatching(/^\d+ms$/),
          );
          expect(res.setHeader).toHaveBeenCalledWith(
            'X-Query-Timestamp',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          );
          done();
        },
      });
    });

    it('should log error with performance data', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const error = new Error('Test error');
      (error as any).status = 500;
      const next = { handle: () => throwError(() => error) } as any;

      interceptor.intercept(ctx, next).subscribe({
        error: () => {
          expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Query failed',
            expect.objectContaining({
              endpoint: 'GET /api/test',
              method: 'GET',
              error: 'Test error',
              statusCode: 500,
            }),
          );
          done();
        },
      });
    });

    it('should default to status 500 when error has no status', (done) => {
      const interceptor = new PerformanceInterceptor();
      const req = createMockRequest();
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const error = new Error('Test error without status');
      const next = { handle: () => throwError(() => error) } as any;

      interceptor.intercept(ctx, next).subscribe({
        error: () => {
          expect(loggerErrorSpy).toHaveBeenCalledWith(
            'Query failed',
            expect.objectContaining({
              statusCode: 500,
            }),
          );
          done();
        },
      });
    });
  });

  describe('request metadata', () => {
    it('should capture correct endpoint from request', (done) => {
      const interceptor = new PerformanceInterceptor({
        logAllQueries: true,
        slowQueryThresholdMs: 10000,
      });
      const req = createMockRequest({
        method: 'POST',
        url: '/api/users/create',
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerDebugSpy).toHaveBeenCalledWith(
            'Query completed',
            expect.objectContaining({
              endpoint: 'POST /api/users/create',
              method: 'POST',
            }),
          );
          done();
        },
      });
    });

    it('should include query params in slow query log', (done) => {
      const interceptor = new PerformanceInterceptor({
        slowQueryThresholdMs: 0,
      });
      const req = createMockRequest({
        query: { filter: 'active', limit: '10' },
      });
      const res = createMockResponse();
      const ctx = makeHttpContext(req, res);
      const next = { handle: () => of({ data: 'test' }) } as any;

      interceptor.intercept(ctx, next).subscribe({
        next: () => {
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            'Slow query detected',
            expect.objectContaining({
              queryParams: { filter: 'active', limit: '10' },
            }),
          );
          done();
        },
      });
    });
  });
});
