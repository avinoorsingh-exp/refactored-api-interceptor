// services/orchestrator/src/common/endpoint.spec.ts
import { normalizeEndpoint } from './endpoint.js';

describe('normalizeEndpoint', () => {
  describe('Query string handling', () => {
    it('should strip query string from URL', () => {
      expect(normalizeEndpoint('/api/users?offset=0&limit=10')).toBe('/api/users');
    });

    it('should strip query string with single parameter', () => {
      expect(normalizeEndpoint('/api/users?id=123')).toBe('/api/users');
    });

    it('should handle URL with only query string', () => {
      expect(normalizeEndpoint('?param=value')).toBe('/');
    });

    it('should handle empty query string', () => {
      expect(normalizeEndpoint('/api/users?')).toBe('/api/users');
    });

    it('should handle multiple query parameters', () => {
      expect(normalizeEndpoint('/api/users?offset=0&limit=25&sort=name&filter=active')).toBe('/api/users');
    });
  });

  describe('UUID replacement', () => {
    it('should replace UUID v4 with :id placeholder', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(normalizeEndpoint(`/api/users/${uuid}`)).toBe('/api/users/:id');
    });

    it('should replace UUID v1 with :id placeholder', () => {
      const uuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      expect(normalizeEndpoint(`/api/users/${uuid}`)).toBe('/api/users/:id');
    });

    it('should replace multiple UUIDs in path', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '660e8400-e29b-41d4-a716-446655440001';
      expect(normalizeEndpoint(`/api/users/${uuid1}/posts/${uuid2}`)).toBe('/api/users/:id/posts/:id');
    });

    it('should handle UUID in uppercase', () => {
      const uuid = '550E8400-E29B-41D4-A716-446655440000';
      expect(normalizeEndpoint(`/api/users/${uuid}`)).toBe('/api/users/:id');
    });

    it('should handle UUID with query string', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(normalizeEndpoint(`/api/users/${uuid}?include=posts`)).toBe('/api/users/:id');
    });
  });

  describe('Numeric ID replacement', () => {
    it('should replace numeric ID with :id placeholder', () => {
      expect(normalizeEndpoint('/api/users/123')).toBe('/api/users/:id');
    });

    it('should replace multiple numeric IDs in path', () => {
      expect(normalizeEndpoint('/api/users/123/posts/456')).toBe('/api/users/:id/posts/:id');
    });

    it('should replace large numeric IDs', () => {
      expect(normalizeEndpoint('/api/users/999999999')).toBe('/api/users/:id');
    });

    it('should replace single digit IDs', () => {
      expect(normalizeEndpoint('/api/users/1')).toBe('/api/users/:id');
    });

    it('should handle numeric ID at end of path', () => {
      expect(normalizeEndpoint('/api/users/123')).toBe('/api/users/:id');
    });

    it('should handle numeric ID with query string', () => {
      expect(normalizeEndpoint('/api/users/123?include=posts')).toBe('/api/users/:id');
    });
  });

  describe('Path lowercasing', () => {
    it('should convert path segments to lowercase', () => {
      expect(normalizeEndpoint('/API/Users/123')).toBe('/api/users/:id');
    });

    it('should handle mixed case path', () => {
      expect(normalizeEndpoint('/Api/Users/GetAll/123')).toBe('/api/users/getall/:id');
    });

    it('should handle all uppercase path', () => {
      expect(normalizeEndpoint('/API/V1/USERS/123')).toBe('/api/v1/users/:id');
    });

    it('should preserve path structure while lowercasing', () => {
      expect(normalizeEndpoint('/API/V1/Users/123/Posts/456')).toBe('/api/v1/users/:id/posts/:id');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizeEndpoint('')).toBe('/');
    });

    it('should handle root path', () => {
      expect(normalizeEndpoint('/')).toBe('/');
    });

    it('should handle path without IDs', () => {
      expect(normalizeEndpoint('/api/users')).toBe('/api/users');
    });

    it('should handle path with only slashes', () => {
      expect(normalizeEndpoint('///')).toBe('///');
    });

    it('should handle mixed UUIDs and numeric IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(normalizeEndpoint(`/api/users/${uuid}/posts/123`)).toBe('/api/users/:id/posts/:id');
    });

    it('should handle path with special characters in segments', () => {
      expect(normalizeEndpoint('/api/users-123')).toBe('/api/users-123');
    });

    it('should handle nested paths with IDs', () => {
      expect(normalizeEndpoint('/api/v1/users/123/posts/456/comments/789')).toBe('/api/v1/users/:id/posts/:id/comments/:id');
    });
  });

  describe('Real-world scenarios', () => {
    it('should normalize agent service endpoint', () => {
      expect(normalizeEndpoint('/v1/countries/123')).toBe('/v1/countries/:id');
    });

    it('should normalize endpoint with UUID and query', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(normalizeEndpoint(`/v1/agents/${uuid}?include=addresses`)).toBe('/v1/agents/:id');
    });

    it('should normalize complex nested endpoint', () => {
      expect(normalizeEndpoint('/API/V1/Users/123/Posts/456?offset=0&limit=10')).toBe('/api/v1/users/:id/posts/:id');
    });
  });
});