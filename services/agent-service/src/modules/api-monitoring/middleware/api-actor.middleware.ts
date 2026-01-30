import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiActorType } from '@exprealty/shared-domain';
import { shouldLogApiRequest } from '@exprealty/api-monitoring';
import { ApiActorService } from '../services/api-actor.service.js';
import { ApiRequestContextService } from '../services/api-request-context.service.js';
import { LoggerService } from '../../../core/logger.service.js';

/**
 * Middleware for attributing API requests to actors.
 * 
 * This middleware runs after authentication and extracts actor information
 * from the request (user, API key, etc.) and stores it in the request context.
 * 
 * The actor is then used for:
 * - Request attribution in logs
 * - Rate limiting
 * - Security monitoring
 * - Usage analytics
 * 
 * @public
 */
@Injectable()
export class ApiActorMiddleware implements NestMiddleware {
	private readonly logger: LoggerService;

	constructor(
		private readonly actorService: ApiActorService,
		private readonly contextService: ApiRequestContextService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService;
		this.logger.setContext('ApiActorMiddleware');
	}

	/**
	 * CENTRALIZED ACTOR RESOLUTION - THE ONLY PLACE WHERE ACTORS ARE CREATED.
	 * 
	 * This is the SINGLE SOURCE OF TRUTH for actor identity.
	 * All other code paths MUST use this function.
	 * 
	 * @param req - Express request object
	 * @returns Resolved actor with stable ID
	 * @throws Error if actor creation violates local Docker rules
	 */
	private async createOrResolveActor(req: Request): Promise<{
		id: string;
		type: ApiActorType;
	}> {
		// CRITICAL: Hard environment guard for local development (NODE_ENV === 'local')
		// This MUST be evaluated FIRST, before any other logic
		// Only activates in local development - NEVER in AWS dev/test/prod
		const isLocal = this.isLocalDockerEnvironment();

		if (isLocal) {
			// FORCE stable actor identity in local development
			// DO NOT read IP, headers, or any request metadata
			// DO NOT fall through to other logic
			const forcedActor = await this.forceLocalDockerActor();
			return forcedActor;
		}

		// Production/dev/test logic: Resolve actor identity using priority rules
		return await this.resolveActorIdentity(req);
	}

	async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		// Policy: Skip actor attribution if request should not be logged
		// This prevents creating actors and logging requests from development/internal traffic
		if (!shouldLogApiRequest(req)) {
			next();
			return;
		}

		// Policy: Skip actor creation for excluded origins (frontend UI, etc.)
		// This prevents creating actors for requests from excluded origins
		if (this.isExcludedOrigin(req)) {
			next();
			return;
		}

		// CENTRALIZED ACTOR RESOLUTION - THE ONLY PLACE WHERE ACTORS ARE CREATED
		// This MUST throw errors - we want the app to crash if actor creation fails
		const resolvedActor = await this.createOrResolveActor(req);

		// Attach actor context to request object for logging layer
		// @ts-expect-error - attaching custom property to request
		req.apiActor = {
			id: resolvedActor.id,
			type: resolvedActor.type,
		};

		// Store in request context for monitoring service
		this.contextService.updateActor(resolvedActor.id, resolvedActor.type);

		// Validation: Log actor resolution for debugging (can be disabled in production)
		// This helps verify stable actor identity across requests
		if (process.env.NODE_ENV !== 'production') {
			this.logger.debug('Resolved actor identity', {
				actorId: resolvedActor.id,
				actorType: resolvedActor.type,
				route: req.route?.path || req.path,
			});
		}

		next();
	}

	/**
	 * Check if running in local development environment.
	 * 
	 * CRITICAL: This flag MUST be evaluated BEFORE any actor resolution logic.
	 * Only activates when NODE_ENV === 'local' to ensure hard stops NEVER run in AWS dev/test/prod.
	 * 
	 * @returns true if NODE_ENV === 'local'
	 */
	private isLocalDockerEnvironment(): boolean {
		return process.env.NODE_ENV === 'local';
	}

	/**
	 * Force stable actor identity for local development environment.
	 * 
	 * DO NOT:
	 * - Read IP address
	 * - Read X-Forwarded-For
	 * - Read headers
	 * - Read user-agent
	 * - Hash anything
	 * - Generate UUIDs
	 * 
	 * ALWAYS returns:
	 * - actorId = 'LOCAL_DOCKER_ACTOR'
	 * - actorType = 'SYSTEM'
	 * 
	 * @returns Forced actor with constant identity
	 */
	private async forceLocalDockerActor(): Promise<{
		id: string;
		type: ApiActorType;
	}> {
		const actor = await this.actorService.getOrCreateActor(
			ApiActorType.SYSTEM,
			'LOCAL_DOCKER_ACTOR', // Constant identifier for local development
			{
				environment: 'local',
				forced: true, // Flag to indicate this is a forced identity
			},
		);
		return { id: actor.id, type: actor.type };
	}

	/**
	 * Resolve actor identity using priority rules.
	 * 
	 * Priority:
	 * 1. Authenticated user (user.id)
	 * 2. User from JWT token or API Gateway headers
	 * 3. API key from Authorization header (raw API key value)
	 * 4. API key (apiKey.id) - if set by auth middleware
	 * 5. Service account (serviceAccount.id)
	 * 6. Local dev fallback (LOCAL_DEV_ACTOR) - if NODE_ENV !== 'production'
	 * 7. Anonymous fallback (ANONYMOUS) - production-safe
	 * 
	 * NOTE: This method is NOT called when isLocalDockerEnvironment() === true
	 * 
	 * @returns Resolved actor with stable ID
	 */
	private async resolveActorIdentity(req: Request): Promise<{
		id: string;
		type: ApiActorType;
	}> {
		// Priority 1: Authenticated user
		// @ts-expect-error - user may be set by auth middleware
		const user = req.user;
		if (user?.id) {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.USER,
				user.id, // Use user.id as identifier for stable resolution
				{
					userId: user.id,
					email: user.email,
					username: user.username,
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 2: Extract user from JWT token or API Gateway headers
		// API Gateway validates API key, then passes user info via JWT or headers
		// We need to identify the actual user, not the shared API key
		
		// TEMPORARY DEBUG: Log all headers to see what API Gateway is sending
		if (process.env.NODE_ENV !== 'production') {
			const allHeaders: Record<string, string | undefined> = {};
			Object.keys(req.headers).forEach((key) => {
				allHeaders[key] = req.get(key) || undefined;
			});
			this.logger.debug('API Gateway request headers (for debugging)', {
				path: req.path,
				method: req.method,
				headers: allHeaders,
				hasAuthorization: !!req.get('authorization'),
				authorizationPrefix: req.get('authorization')?.substring(0, 20) || 'none',
			});
		}
		
		const userFromToken = this.extractUserFromToken(req);
		if (userFromToken?.id) {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.USER,
				userFromToken.id, // Use user.id as identifier for stable resolution
				{
					userId: userFromToken.id,
					email: userFromToken.email,
					username: userFromToken.username,
					source: 'jwt_token_or_headers',
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 3: Extract API key directly from Authorization header
		// API Gateway passes the API key value directly (not as Bearer token)
		// Since the API key is shared by multiple users, we use it as a stable identifier
		// This ensures all requests using the same API key are attributed to the same actor
		const apiKeyFromHeader = this.extractApiKeyFromHeader(req);
		if (apiKeyFromHeader) {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.API_KEY,
				apiKeyFromHeader, // Use API key value as identifier for stable resolution
				{
					apiKeyValue: apiKeyFromHeader,
					source: 'authorization_header',
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 4: API key (only if set by auth middleware/guard with user context)
		// @ts-expect-error - apiKey may be set by auth middleware
		const apiKey = req.apiKey;
		if (apiKey?.id) {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.API_KEY,
				apiKey.id, // Use apiKey.id as identifier for stable resolution
				{
					apiKeyId: apiKey.id,
					apiKeyName: apiKey.name,
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 5: Service account
		// @ts-expect-error - serviceAccount may be set by auth middleware
		const serviceAccount = req.serviceAccount;
		if (serviceAccount?.id) {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.SERVICE_ACCOUNT,
				serviceAccount.id, // Use serviceAccount.id as identifier for stable resolution
				{
					serviceAccountId: serviceAccount.id,
					serviceAccountName: serviceAccount.name,
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 6: Local development fallback
		// Use constant actor ID for dev mode to ensure stable identity
		if (process.env.NODE_ENV !== 'production') {
			const actor = await this.actorService.getOrCreateActor(
				ApiActorType.SYSTEM,
				'LOCAL_DEV_ACTOR', // Constant identifier for dev mode
				{
					environment: 'local_dev',
				},
			);
			return { id: actor.id, type: actor.type };
		}

		// Priority 7: Anonymous fallback (production-safe)
		// Use constant actor ID for anonymous requests to ensure stable identity
		const actor = await this.actorService.getOrCreateActor(
			ApiActorType.ANONYMOUS,
			'ANONYMOUS', // Constant identifier for anonymous requests
			{
				ip: this.extractIpAddress(req), // Store IP in metadata for reference
			},
		);
		return { id: actor.id, type: actor.type };
	}

	/**
	 * Extract client IP address from request.
	 * Handles proxies and load balancers.
	 */
	private extractIpAddress(request: Request): string | undefined {
		// Check X-Forwarded-For header (from proxies/load balancers)
		const forwardedFor = request.get('x-forwarded-for');
		if (forwardedFor) {
			// X-Forwarded-For can contain multiple IPs, take the first one
			const ips = forwardedFor.split(',').map((ip) => ip.trim());
			const ip = ips[0];
			if (ip) {
				return ip;
			}
		}

		// Check X-Real-IP header
		const realIp = request.get('x-real-ip');
		if (realIp) {
			return realIp;
		}

		// Fall back to request IP or socket remote address
		const ip = request.ip || request.socket?.remoteAddress;
		if (ip) {
			return ip;
		}

		return undefined;
	}

	/**
	 * Extract user information from JWT token or API Gateway headers.
	 * 
	 * API Gateway validates API key, then passes user info via:
	 * - JWT token in Authorization header (Bearer token)
	 * - Custom headers (X-User-Id, X-User-Email, etc.)
	 * 
	 * @param req - Express request object
	 * @returns User info if found, undefined otherwise
	 */
	private extractUserFromToken(req: Request): {
		id: string;
		email?: string;
		username?: string;
	} | undefined {
		// Check for user info in custom headers (API Gateway may set these)
		// Try multiple common header name variations
		const userIdFromHeader =
			req.get('x-user-id') ||
			req.get('x-userid') ||
			req.get('user-id') ||
			req.get('x-cognito-username') ||
			req.get('x-cognito-user-id') ||
			req.get('x-aws-user-id');

		if (userIdFromHeader) {
			const userInfo = {
				id: userIdFromHeader,
				email: req.get('x-user-email') || req.get('user-email') || req.get('x-cognito-email') || undefined,
				username: req.get('x-username') || req.get('username') || req.get('x-cognito-username') || undefined,
			};

			if (process.env.NODE_ENV !== 'production') {
				this.logger.debug('Extracted user from headers', {
					userId: userInfo.id,
					hasEmail: !!userInfo.email,
					hasUsername: !!userInfo.username,
				});
			}

			return userInfo;
		}

		// Try to extract user info from JWT token in Authorization header
		const authHeader = req.get('authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return undefined;
		}

		const token = authHeader.substring(7).trim();
		if (!token) {
			return undefined;
		}

		// Decode JWT token (without verification - API Gateway already validated it)
		// JWT format: header.payload.signature
		// We only need the payload to extract user info
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				return undefined;
			}

			// Decode base64url payload (JWT uses base64url, not base64)
			const payload = parts[1];
			// Add padding if needed for base64 decoding
			const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
			const decoded = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
			const claims = JSON.parse(decoded) as Record<string, unknown>;

			// Extract user ID from common JWT claim fields
			// Common fields: sub, userId, id, user_id, email, username (for email-based IDs)
			// Also check Cognito-specific claims: 'cognito:username', 'cognito:sub'
			const userId =
				(claims.sub as string) ||
				(claims['cognito:username'] as string) ||
				(claims['cognito:sub'] as string) ||
				(claims.userId as string) ||
				(claims.id as string) ||
				(claims.user_id as string) ||
				(claims.username as string) ||
				(claims.email as string); // Fallback to email if no ID field

			if (!userId) {
				if (process.env.NODE_ENV !== 'production') {
					this.logger.debug('JWT token found but no user ID in claims', {
						availableClaims: Object.keys(claims),
					});
				}
				return undefined;
			}

			const userInfo = {
				id: userId,
				email: (claims.email as string) || undefined,
				username:
					(claims.username as string) ||
					(claims['cognito:username'] as string) ||
					(claims.preferred_username as string) ||
					undefined,
			};

			if (process.env.NODE_ENV !== 'production') {
				this.logger.debug('Extracted user from JWT token', {
					userId: userInfo.id,
					hasEmail: !!userInfo.email,
					hasUsername: !!userInfo.username,
				});
			}

			return userInfo;
		} catch (error) {
			// If JWT decoding fails, log and return undefined
			// This is expected if the token is not a JWT or is malformed
			if (process.env.NODE_ENV !== 'production') {
				this.logger.debug('Failed to decode JWT token for user extraction', {
					error: error instanceof Error ? error.message : String(error),
					authHeaderPrefix: authHeader?.substring(0, 20),
				});
			}
			return undefined;
		}
	}

	/**
	 * Extract API key from Authorization header.
	 * 
	 * API Gateway passes the API key value directly (not as Bearer token).
	 * Format: "0zAoKyp4ZT84XkU8YD8oh3PdqI9lXfJMaB5vszMo"
	 * 
	 * @param req - Express request object
	 * @returns API key value if found, undefined otherwise
	 */
	private extractApiKeyFromHeader(req: Request): string | undefined {
		const authHeader = req.get('authorization');
		if (!authHeader) {
			return undefined;
		}

		// Check if it's a Bearer token (JWT format)
		if (authHeader.startsWith('Bearer ')) {
			// This is a JWT token, not an API key
			// Let extractUserFromToken handle it
			return undefined;
		}

		// API Gateway passes the API key value directly
		// Return the trimmed value
		const apiKey = authHeader.trim();
		if (apiKey.length === 0) {
			return undefined;
		}

		if (process.env.NODE_ENV !== 'production') {
			this.logger.debug('Extracted API key from authorization header', {
				apiKeyPrefix: apiKey.substring(0, 10) + '...',
				apiKeyLength: apiKey.length,
			});
		}

		return apiKey;
	}

	/**
	 * Check if request is from an excluded origin (frontend UI, etc.).
	 * Uses API_MONITORING_EXCLUDE_ORIGINS environment variable.
	 * 
	 * @param req - Express request object
	 * @returns true if request should be excluded from actor creation
	 */
	private isExcludedOrigin(req: Request): boolean {
		const excludedOrigins = this.getExcludedOrigins();
		if (excludedOrigins.length === 0) {
			return false;
		}

		const origin = req.get('origin');
		const referer = req.get('referer');

		// Check Origin header
		if (origin) {
			const originUrl = this.parseUrl(origin);
			if (originUrl && this.isExcludedOriginMatch(originUrl, excludedOrigins)) {
				return true;
			}
		}

		// Check Referer header
		if (referer) {
			const refererUrl = this.parseUrl(referer);
			if (refererUrl && this.isExcludedOriginMatch(refererUrl, excludedOrigins)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get list of excluded origins from environment variable.
	 * Format: comma-separated list of domains (e.g., "nexus.example.com,app.example.com")
	 */
	private getExcludedOrigins(): string[] {
		const excluded = process.env.API_MONITORING_EXCLUDE_ORIGINS;
		if (!excluded) {
			return [];
		}
		return excluded.split(',').map((domain) => domain.trim().toLowerCase());
	}

	/**
	 * Check if a URL matches any excluded origin.
	 */
	private isExcludedOriginMatch(url: URL, excludedOrigins: string[]): boolean {
		const hostname = url.hostname.toLowerCase();

		for (const excluded of excludedOrigins) {
			// Support exact match or subdomain match (e.g., "nexus" matches "nexus.example.com")
			if (hostname === excluded || hostname.endsWith(`.${excluded}`) || hostname.includes(excluded)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Parse a URL string, handling both full URLs and hostnames.
	 */
	private parseUrl(urlString: string): URL | null {
		try {
			// If it's already a full URL, parse directly
			if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
				return new URL(urlString);
			}
			// If it's just a hostname, construct a URL
			return new URL(`https://${urlString}`);
		} catch {
			return null;
		}
	}
}

