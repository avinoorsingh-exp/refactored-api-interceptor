import type { Request } from 'express';
import { shouldLogApiRequest } from '../../src/utils/should-log-api-request.util.js';

/** Mutable stand-in for `Request` (Express types mark `ip` read-only). */
type ShouldLogRequestMock = {
	get: jest.Mock;
	ip?: string;
	socket?: { remoteAddress?: string };
};

describe('should-log-api-request.util', () => {
	let mockRequest: ShouldLogRequestMock;
	let originalNodeEnv: string | undefined;

	beforeEach(() => {
		originalNodeEnv = process.env.NODE_ENV;
		mockRequest = {
			get: jest.fn(),
			ip: '203.0.113.1',
			socket: { remoteAddress: '203.0.113.1' },
		};
	});

	afterEach(() => {
		if (originalNodeEnv !== undefined) {
			process.env.NODE_ENV = originalNodeEnv;
		} else {
			delete process.env.NODE_ENV;
		}
		delete process.env.API_MONITORING_EXCLUDE_ORIGINS;
	});

	describe('shouldLogApiRequest', () => {
		it('should return false for development environment', () => {
			process.env.NODE_ENV = 'development';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for local environment', () => {
			process.env.NODE_ENV = 'local';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for requests with X-Internal-Request header', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.get.mockImplementation((header: string) => {
				if (header === 'x-internal-request') {
					return 'true';
				}
				return undefined;
			});
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for localhost IP', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '127.0.0.1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for private IP ranges', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '192.168.1.1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for 10.x.x.x IP range', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '10.0.0.1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for 172.16-31.x.x IP range', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '172.20.0.1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for IPv6-mapped private IP', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '::ffff:192.168.1.1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for localhost origin', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.get.mockImplementation((header: string) => {
				if (header === 'origin') {
					return 'http://localhost:3000';
				}
				return undefined;
			});
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for localhost referer', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.get.mockImplementation((header: string) => {
				if (header === 'referer') {
					return 'http://127.0.0.1:3000';
				}
				return undefined;
			});
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false when IP cannot be determined', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = undefined;
			mockRequest.socket = undefined;
			mockRequest.get.mockReturnValue(undefined);
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return true for external IP in production', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '203.0.113.1';
			mockRequest.get.mockReturnValue(undefined);
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(true);
		});

		it('should extract IP from X-Forwarded-For header', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = undefined;
			mockRequest.get.mockImplementation((header: string) => {
				if (header === 'x-forwarded-for') {
					return '203.0.113.1, 192.168.1.1';
				}
				return undefined;
			});
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(true);
		});

		it('should extract IP from X-Real-IP header', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = undefined;
			mockRequest.get.mockImplementation((header: string) => {
				if (header === 'x-real-ip') {
					return '203.0.113.1';
				}
				return undefined;
			});
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(true);
		});

		it('should return false for IPv6 localhost', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = '::1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for IPv6 private range', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = 'fc00::1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});

		it('should return false for IPv6 link-local', () => {
			process.env.NODE_ENV = 'production';
			mockRequest.ip = 'fe80::1';
			expect(shouldLogApiRequest(mockRequest as unknown as Request)).toBe(false);
		});
	});
});

