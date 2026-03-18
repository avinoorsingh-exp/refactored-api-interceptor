import type { Request } from 'express';

/**
 * Guest scope that receives minimal agent data (no includes, limited fields).
 * When the Bearer token has scope "agent-service/read", the agent route
 * ignores client includes and returns only id, firstName, lastName,
 * lifecycleStatus, primaryEmail.value, primaryAddress country/state names.
 */
export const GUEST_SCOPE_AGENT_READ = 'agent-service/read';

/**
 * Decodes the JWT payload from the Authorization header without verification.
 * Verification is assumed to be done by the API Gateway / Lambda authorizer.
 *
 * @param req - Express request (must have Authorization: Bearer <token>)
 * @returns The scope string from payload.scope, or null if missing/invalid
 */
export function getScopeFromAuthorizationHeader(req: Request): string | null {
	const auth = req.headers?.authorization ?? req.headers?.Authorization;
	if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
		return null;
	}
	const token = auth.slice(7).trim();
	if (!token) return null;

	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		// JWT payload is the second part (base64url)
		const payloadBase64 = parts[1];
		const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
		const payload = JSON.parse(payloadJson) as { scope?: string };
		return typeof payload.scope === 'string' ? payload.scope : null;
	} catch {
		return null;
	}
}

/**
 * Returns true when the request should receive minimal agent data
 * (scope is exactly "agent-service/read").
 */
export function isGuestScopeAgentRead(req: Request): boolean {
	return getScopeFromAuthorizationHeader(req) === GUEST_SCOPE_AGENT_READ;
}
