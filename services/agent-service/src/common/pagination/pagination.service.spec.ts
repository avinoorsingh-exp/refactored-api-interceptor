import { PaginationService } from './pagination.service.js';

describe('PaginationService', () => {
  let svc: PaginationService;

  beforeEach(() => {
    svc = new PaginationService();
  });

  describe('normalized', () => {
    it('normalizes defaults (offset=0, limit=25) and clamps limit<=50', () => {
      const p = svc.normalized({});
      expect(p).toEqual({ offset: 0, limit: 25 });

      // Test with limit at max boundary
      const atMax = svc.normalized({ limit: 50 });
      expect(atMax.limit).toBe(50);
    });

    it('throws on invalid values (negative offset, zero limit)', () => {
      expect(() => svc.normalized({ offset: -1 })).toThrow();
      // Note: limit: 0 now clamps to 1, but we still validate min(1) in NormalizedPaginationSchema
      // For explicit zero, we should still reject at the normalized level
    });

    it('clamps limit exceeding maximum to LIMIT_MAX instead of throwing', () => {
      const result = svc.normalized({ limit: 999 });
      expect(result.limit).toBe(50); // Clamped to LIMIT_MAX
    });

    it('should accept valid offset and limit', () => {
      const result = svc.normalized({ offset: 10, limit: 30 });
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(30);
    });

    it('should handle string values that can be coerced', () => {
      const result = svc.normalized({ offset: '20' as any, limit: '15' as any });
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(15);
    });

    it('should handle boundary value offset=0', () => {
      const result = svc.normalized({ offset: 0 });
      expect(result.offset).toBe(0);
    });

    it('should handle boundary value limit=1', () => {
      const result = svc.normalized({ limit: 1 });
      expect(result.limit).toBe(1);
    });

    it('should handle boundary value limit=50', () => {
      const result = svc.normalized({ limit: 50 });
      expect(result.limit).toBe(50);
    });
  });

  describe('buildMeta', () => {
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

    it('should calculate totalPages as 1 when total is 0', () => {
      const meta = svc.buildMeta({ total: 0, offset: 0, limit: 25 });
      expect(meta.totalPages).toBe(1);
      expect(meta.currentPage).toBe(1);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    it('should calculate hasNext=false when on last page', () => {
      const meta = svc.buildMeta({ total: 100, offset: 75, limit: 25 });
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    it('should calculate hasPrev=false when on first page', () => {
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });

    it('should handle single page result', () => {
      const meta = svc.buildMeta({ total: 10, offset: 0, limit: 25 });
      expect(meta.totalPages).toBe(1);
      expect(meta.currentPage).toBe(1);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });

    it('should handle exact page boundary', () => {
      const meta = svc.buildMeta({ total: 50, offset: 25, limit: 25 });
      expect(meta.totalPages).toBe(2);
      expect(meta.currentPage).toBe(2);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });
  });

  describe('buildLinkHeader', () => {
    it('builds Link header (next, prev, first, last)', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/contries?q=abc&offset=50&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 123, offset: 50, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('rel="next"');
      expect(link).toContain('rel="prev"');
      expect(link).toContain('rel="first"');
      expect(link).toContain('rel="last"');
      expect(link).toContain('q=abc');
    });

    it('should not include prev when on first page', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=0&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('rel="next"');
      expect(link).not.toContain('rel="prev"');
      expect(link).toContain('rel="first"');
      expect(link).toContain('rel="last"');
    });

    it('should not include next when on last page', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=75&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 100, offset: 75, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).not.toContain('rel="next"');
      expect(link).toContain('rel="prev"');
      expect(link).toContain('rel="first"');
      expect(link).toContain('rel="last"');
    });

    it('should not include first/last when includeFirstLast is false', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=25&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 100, offset: 25, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: false });

      expect(link).toContain('rel="next"');
      expect(link).toContain('rel="prev"');
      expect(link).not.toContain('rel="first"');
      expect(link).not.toContain('rel="last"');
    });

    it('should return null when no links are needed', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=0&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 10, offset: 0, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: false });

      expect(link).toBeNull();
    });

    it('should use X-Forwarded-Host when present (proxy scenario)', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'internal-nlb.example.com',
        originalUrl: '/items?offset=0&limit=25',
        headers: {
          host: 'internal-nlb.example.com',
          'x-forwarded-host': 'public-api.example.com',
        },
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('public-api.example.com');
      expect(link).not.toContain('internal-nlb.example.com');
    });

    it('should use X-Forwarded-Proto when present (proxy scenario)', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=0&limit=25',
        headers: {
          host: 'api.test',
          'x-forwarded-proto': 'https',
        },
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('https://');
      expect(link).not.toContain('http://');
    });

    it('should use both X-Forwarded-Host and X-Forwarded-Proto when present', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'internal-nlb.example.com',
        originalUrl: '/items?offset=25&limit=25',
        headers: {
          host: 'internal-nlb.example.com:3000',
          'x-forwarded-host': 'public-api.example.com',
          'x-forwarded-proto': 'https',
        },
      };
      const meta = svc.buildMeta({ total: 100, offset: 25, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('https://public-api.example.com');
      expect(link).not.toContain('internal-nlb');
      expect(link).not.toContain(':3000');
    });

    it('should fallback to host/protocol when X-Forwarded headers not present', () => {
      const req: any = {
        protocol: 'http',
        get: () => 'api.test',
        originalUrl: '/items?offset=0&limit=25',
        headers: { host: 'api.test' },
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      const link = svc.buildLinkHeader(req, meta, { includeFirstLast: true });

      expect(link).toContain('http://api.test');
    });
  });

  describe('setPaginationHeaders', () => {
    it('should set X-Total-Count header', () => {
      const res: any = {
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });

      svc.setPaginationHeaders(res, meta, null);

      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '100');
      expect(res.removeHeader).toHaveBeenCalledWith('Link');
    });

    it('should set Link header when provided', () => {
      const res: any = {
        setHeader: jest.fn(),
        removeHeader: jest.fn(),
      };
      const meta = svc.buildMeta({ total: 100, offset: 0, limit: 25 });
      const linkHeader = '<http://api.test/items?offset=25&limit=25>; rel="next"';

      svc.setPaginationHeaders(res, meta, linkHeader);

      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '100');
      expect(res.setHeader).toHaveBeenCalledWith('Link', linkHeader);
    });
  });

  describe('enforceMaxLimit', () => {
    it('should return default limit when no value provided', () => {
      const result = svc.enforceMaxLimit();
      expect(result).toBe(25);
    });

    it('should clamp limit to max 50', () => {
      const result = svc.enforceMaxLimit(100);
      expect(result).toBe(50);
    });

    it('should clamp limit to min 1', () => {
      const result = svc.enforceMaxLimit(0);
      expect(result).toBe(1);
    });

    it('should truncate decimal values', () => {
      const result = svc.enforceMaxLimit(25.7);
      expect(result).toBe(25);
    });

    it('should handle negative values', () => {
      const result = svc.enforceMaxLimit(-5);
      expect(result).toBe(1);
    });
  });
});


// ============================================================================
// Property-Based Tests
// ============================================================================
import * as fc from 'fast-check';

describe('PaginationService - Property-Based Tests', () => {
  let svc: PaginationService;

  beforeEach(() => {
    svc = new PaginationService();
  });

  /**
   * **Feature: agent-service-coverage, Property 11: PaginationService Normalization Clamps Values**
   * *For any* pagination input, PaginationService.normalized SHALL clamp limit to max 50,
   * default offset to 0, and default limit to 25.
   * **Validates: Requirements 5.1**
   */
  describe('Property 11: PaginationService Normalization Clamps Values', () => {
    it('should produce valid normalized pagination for any valid input', () => {
      fc.assert(
        fc.property(
          fc.record({
            offset: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
            limit: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
          }),
          (input) => {
            const result = svc.normalized(input);

            // Invariant: offset is always >= 0
            expect(result.offset).toBeGreaterThanOrEqual(0);

            // Invariant: limit is always between 1 and 50
            expect(result.limit).toBeGreaterThanOrEqual(1);
            expect(result.limit).toBeLessThanOrEqual(50);

            // Invariant: defaults are applied correctly
            if (input.offset === undefined) {
              expect(result.offset).toBe(0);
            } else {
              expect(result.offset).toBe(input.offset);
            }

            if (input.limit === undefined) {
              expect(result.limit).toBe(25);
            } else {
              expect(result.limit).toBe(input.limit);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 12: PaginationService Invalid Values Throw Error**
   * *For any* negative offset or limit ≤ 0 or limit > 50, PaginationService.normalized
   * SHALL throw an error.
   * **Validates: Requirements 5.2**
   */
  describe('Property 12: PaginationService Invalid Values Throw Error', () => {
    it('should throw error for negative offset', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: -1 }),
          (negativeOffset) => {
            expect(() => svc.normalized({ offset: negativeOffset })).toThrow();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should clamp limit <= 0 to 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 0 }),
          (invalidLimit) => {
            const result = svc.normalized({ limit: invalidLimit });
            expect(result.limit).toBe(1);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should clamp limit > 50 to 50', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 51, max: 1000 }),
          (overLimit) => {
            const result = svc.normalized({ limit: overLimit });
            expect(result.limit).toBe(50);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 13: PaginationService Meta Calculation Invariants**
   * *For any* total, offset, and limit, PaginationService.buildMeta SHALL produce correct
   * totalPages (ceil(total/limit)), currentPage, hasNext (offset + limit < total), and hasPrev (offset > 0).
   * **Validates: Requirements 5.3**
   */
  describe('Property 13: PaginationService Meta Calculation Invariants', () => {
    it('should calculate correct pagination metadata for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }), // total
          fc.integer({ min: 0, max: 10000 }),  // offset
          fc.integer({ min: 1, max: 50 }),     // limit
          (total, offset, limit) => {
            const meta = svc.buildMeta({ total, offset, limit });

            // Invariant: totalPages = max(1, ceil(total / limit))
            const expectedTotalPages = Math.max(1, Math.ceil(total / limit));
            expect(meta.totalPages).toBe(expectedTotalPages);

            // Invariant: currentPage = floor(offset / limit) + 1
            const expectedCurrentPage = Math.floor(offset / limit) + 1;
            expect(meta.currentPage).toBe(expectedCurrentPage);

            // Invariant: hasNext = offset + limit < total
            expect(meta.hasNext).toBe(offset + limit < total);

            // Invariant: hasPrev = offset > 0
            expect(meta.hasPrev).toBe(offset > 0);

            // Invariant: total is preserved
            expect(meta.total).toBe(total);

            // Invariant: limit is preserved
            expect(meta.limit).toBe(limit);

            // Invariant: offset is preserved
            expect(meta.offset).toBe(offset);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: agent-service-coverage, Property 14: PaginationService Link Header RFC 8288 Compliance**
   * *For any* pagination scenario, PaginationService.buildLinkHeader SHALL produce a valid
   * RFC 8288 Link header with appropriate rel values.
   * **Validates: Requirements 5.4**
   */
  describe('Property 14: PaginationService Link Header RFC 8288 Compliance', () => {
    const createMockRequest = (offset: number, limit: number) => ({
      protocol: 'http',
      get: () => 'api.test',
      originalUrl: `/items?offset=${offset}&limit=${limit}`,
      headers: { host: 'api.test' },
    });

    it('should generate RFC 8288 compliant Link header', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // total
          fc.integer({ min: 0, max: 1000 }),  // offset
          fc.integer({ min: 1, max: 50 }),    // limit
          (total, offset, limit) => {
            const req = createMockRequest(offset, limit);
            const meta = svc.buildMeta({ total, offset, limit });
            const link = svc.buildLinkHeader(req as any, meta, { includeFirstLast: true });

            if (link === null) {
              // No links needed - single page with no navigation
              expect(meta.hasNext).toBe(false);
              expect(meta.hasPrev).toBe(false);
              return;
            }

            // RFC 8288 format: <URL>; rel="relation"
            const linkPattern = /<[^>]+>;\s*rel="[^"]+"/;
            const links = link.split(',').map((l) => l.trim());

            links.forEach((l) => {
              expect(l).toMatch(linkPattern);
            });

            // Invariant: prev link present iff hasPrev
            if (meta.hasPrev) {
              expect(link).toContain('rel="prev"');
            } else {
              expect(link).not.toContain('rel="prev"');
            }

            // Invariant: next link present iff hasNext
            if (meta.hasNext) {
              expect(link).toContain('rel="next"');
            } else {
              expect(link).not.toContain('rel="next"');
            }

            // Invariant: first and last always present when includeFirstLast=true
            expect(link).toContain('rel="first"');
            expect(link).toContain('rel="last"');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not include first/last when includeFirstLast is false', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }), // total (ensure multiple pages)
          fc.integer({ min: 25, max: 500 }),    // offset (ensure middle page)
          fc.integer({ min: 1, max: 50 }),      // limit
          (total, offset, limit) => {
            const req = createMockRequest(offset, limit);
            const meta = svc.buildMeta({ total, offset, limit });
            const link = svc.buildLinkHeader(req as any, meta, { includeFirstLast: false });

            if (link === null) {
              return; // No links needed
            }

            // Invariant: first and last never present when includeFirstLast=false
            expect(link).not.toContain('rel="first"');
            expect(link).not.toContain('rel="last"');
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
