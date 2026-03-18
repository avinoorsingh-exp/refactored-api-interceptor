import {
	getScopeFromAuthorizationHeader,
	isGuestScopeAgentRead,
	GUEST_SCOPE_AGENT_READ,
} from './jwt-scope.util.js';
import type { Request } from 'express';

function base64urlEncode(str: string): string {
	return Buffer.from(str, 'utf8').toString('base64url');
}

function makeJwt(payload: Record<string, unknown>): string {
	const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payloadPart = base64urlEncode(JSON.stringify(payload));
	const sig = base64urlEncode('signature');
	return `${header}.${payloadPart}.${sig}`;
}

describe('jwt-scope.util', () => {
	describe('getScopeFromAuthorizationHeader', () => {
		it('returns scope from valid Bearer token', () => {
			const token = makeJwt({ scope: 'agent-service/read' });
			const req = { headers: { authorization: `Bearer ${token}` } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBe('agent-service/read');
		});

		it('returns null when Authorization header is missing', () => {
			const req = { headers: {} } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBeNull();
		});

		it('returns null when header does not start with Bearer ', () => {
			const req = { headers: { authorization: 'Basic xyz' } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBeNull();
		});

		it('returns null when token is empty after Bearer ', () => {
			const req = { headers: { authorization: 'Bearer ' } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBeNull();
		});

		it('returns null when token has invalid JWT structure (not 3 parts)', () => {
			const req = { headers: { authorization: 'Bearer invalid' } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBeNull();
		});

		it('returns null when payload has no scope', () => {
			const token = makeJwt({ sub: 'user-1' });
			const req = { headers: { authorization: `Bearer ${token}` } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBeNull();
		});

		it('returns scope for signed-in token (openid profile email)', () => {
			const token = makeJwt({
				scope: 'aws.cognito.signin.user.admin openid profile email',
				'cognito:groups': ['us-east-1_T2y4JUNBj_agent-service'],
			});
			const req = { headers: { authorization: `Bearer ${token}` } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBe(
				'aws.cognito.signin.user.admin openid profile email',
			);
		});

		it('accepts Authorization with capital A (Express may normalize)', () => {
			const token = makeJwt({ scope: 'agent-service/read' });
			const req = { headers: { Authorization: `Bearer ${token}` } } as Request;
			expect(getScopeFromAuthorizationHeader(req)).toBe('agent-service/read');
		});
	});

	describe('isGuestScopeAgentRead', () => {
		it('returns true when scope is agent-service/read', () => {
			const token = makeJwt({ scope: 'agent-service/read' });
			const req = { headers: { authorization: `Bearer ${token}` } } as Request;
			expect(isGuestScopeAgentRead(req)).toBe(true);
		});

		it('returns false when scope is different', () => {
			const token = makeJwt({ scope: 'openid profile email' });
			const req = { headers: { authorization: `Bearer ${token}` } } as Request;
			expect(isGuestScopeAgentRead(req)).toBe(false);
		});

		it('returns false when no token', () => {
			const req = { headers: {} } as Request;
			expect(isGuestScopeAgentRead(req)).toBe(false);
		});
	});

	describe('GUEST_SCOPE_AGENT_READ', () => {
		it('is the string agent-service/read', () => {
			expect(GUEST_SCOPE_AGENT_READ).toBe('agent-service/read');
		});
	});
});
