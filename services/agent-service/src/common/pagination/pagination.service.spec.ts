import { PaginationService } from './pagination.service.js';

describe('PaginationService', () => {
  let svc: PaginationService;

  beforeEach(() => {
    svc = new PaginationService();
  });

  it('normalizes defaults (offset=0, limit=25) and clamps limit<=50', () => {
    const p = svc.normalized({});
    expect(p).toEqual({ offset: 0, limit: 25 });

    // Test with limit at max boundary
    const atMax = svc.normalized({ limit: 50 });
    expect(atMax.limit).toBe(50);
  });

  it('throws on invalid values', () => {
    expect(() => svc.normalized({ offset: -1 })).toThrow();
    expect(() => svc.normalized({ limit: 0 })).toThrow();
    expect(() => svc.normalized({ limit: 999 })).toThrow(); // Over max
  });

  it('builds meta correctly', () => {
    const meta = svc.buildMeta({ total: 123, offset: 50, limit: 25 });
    expect(meta).toMatchObject({
      total: 123,
      totalPages: 5,
      currentPage: 3,
      limit: 25,
      offset: 50,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('builds Link header (next, prev, first, last)', () => {
    // minimal mock Request/Response context
    const req: any = {
      protocol: 'http',
      get: () => 'api.test',
      originalUrl: '/contries?q=abc&offset=50&limit=25',
      headers: { host: 'api.test' },
    };
    const meta = svc.buildMeta({ total: 123, offset: 50, limit: 25 });
    const link = svc.buildLinkHeader(req as any, meta, { includeFirstLast: true });

    expect(link).toContain('rel="next"');
    expect(link).toContain('rel="prev"');
    expect(link).toContain('rel="first"');
    expect(link).toContain('rel="last"');
    // preserve q=abc
    expect(link).toContain('q=abc');
  });
});
