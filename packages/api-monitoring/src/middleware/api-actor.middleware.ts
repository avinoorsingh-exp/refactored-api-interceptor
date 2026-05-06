import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiActorType } from '../domain/api-monitoring.types.js';
import { ApiActorService } from '../services/api-actor.service.js';
import { ApiMonitoringUserService } from '../services/api-monitoring-user.service.js';
import { ApiRequestContextService } from '../services/api-request-context.service.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import { API_MONITORING_LOGGER_TOKEN } from '../interfaces/logger.interface.js';
import { parseSourceApplicationHeader } from '../utils/parse-source-application-header.util.js';

type ActorUserStub = { id?: string; email?: string; username?: string };
type ApiKeyStub = { id?: string; name?: string };
type ServiceAccountStub = { id?: string; name?: string };

type RequestWithActorSources = Request & {
	user?: ActorUserStub;
	apiKey?: ApiKeyStub;
	serviceAccount?: ServiceAccountStub;
};

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
	private readonly logger: IApiMonitoringLogger;

	constructor(
		private readonly actorService: ApiActorService,
		private readonly monitoringUserService: ApiMonitoringUserService,
		private readonly contextService: ApiRequestContextService,
		@Inject(API_MONITORING_LOGGER_TOKEN)
		logger: IApiMonitoringLogger,
	) {
		this.logger = logger;
		this.logger.setContext('ApiActorMiddleware');
		this.logger.info('ApiActorMiddleware initialized successfully');
	}

	async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			// Policy: Skip actor creation for excluded origins (frontend UI, etc.)
			// This prevents creating actors for requests from excluded origins
			if (this.isExcludedOrigin(req)) {
				next();
				return;
			}

			// Extract actor information from request
			// This assumes authentication middleware has set user/API key info
			// Adjust these paths based on your authentication implementation
			const actorInfo = this.extractActorFromRequest(req);

			if (actorInfo) {
				// Get or create actor in database
				const actor = await this.actorService.getOrCreateActor(
					actorInfo.type,
					actorInfo.identifier,
					actorInfo.metadata,
				);

				// Store in request context
				this.contextService.updateActor(actor.id, actor.type);

				if (actorInfo.type === ApiActorType.USER) {
					const ext =
						(typeof actorInfo.metadata?.userId === 'string' ? actorInfo.metadata.userId : undefined) ||
						(typeof actorInfo.identifier === 'string' ? actorInfo.identifier : undefined);
					const email =
						(typeof actorInfo.metadata?.email === 'string' && actorInfo.metadata.email) ||
						(req as RequestWithActorSources).user?.email;
					if (ext) {
						const sourceApplication = parseSourceApplicationHeader((name) => req.get(name));
						const profile = await this.monitoringUserService.upsertForUserActor({
							externalId: ext,
							email,
							actorId: actor.id,
							sourceApplication,
						});
						if (profile?.id) {
							this.contextService.updateMonitoringUser(profile.id);
						}
					}
				}
			} else {
				// Anonymous request
				// Use constant identifier for anonymous requests to ensure stable identity
				const anonymousActor = await this.actorService.getOrCreateActor(
					ApiActorType.ANONYMOUS,
					'ANONYMOUS', // Constant identifier for anonymous requests
					{ ip: req.ip },
				);

				this.contextService.updateActor(anonymousActor.id, ApiActorType.ANONYMOUS);
			}
		} catch (error) {
			// Log error but don't block request
			// Monitoring failures should never break requests
			this.logger.error('Failed to attribute actor', {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		next();
	}

	/**
	 * Extract actor information from authenticated request.
	 * 
	 * This method should be customized based on your authentication implementation.
	 * Common patterns:
	 * - JWT token in Authorization header → extract user ID
	 * - API key in header → extract API key ID
	 * - Session-based auth → extract user from session
	 */
	private extractActorFromRequest(req: Request): {
		type: ApiActorType;
		identifier?: string;
		metadata?: Record<string, unknown>;
	} | null {
		const r = req as RequestWithActorSources;

		// Check for authenticated user (adjust based on your auth implementation)
		const user = r.user;
		if (user?.id) {
			return {
				type: ApiActorType.USER,
				identifier: user.email || user.username || user.id,
				metadata: {
					userId: user.id,
					username: user.username,
					email: user.email,
				},
			};
		}

		// Extract user from JWT token or API Gateway headers
		const userFromToken = this.extractUserFromToken(req);
		if (userFromToken?.id) {
			return {
				type: ApiActorType.USER,
				identifier: userFromToken.id,
				metadata: {
					userId: userFromToken.id,
					email: userFromToken.email,
					username: userFromToken.username,
					source: 'jwt_token_or_headers',
				},
			};
		}

		// Extract API key directly from Authorization header
		// API Gateway passes the API key value directly (not as Bearer token)
		// Since the API key is shared by multiple users, we use it as a stable identifier
		const apiKeyFromHeader = this.extractApiKeyFromHeader(req);
		if (apiKeyFromHeader) {
			return {
				type: ApiActorType.API_KEY,
				identifier: apiKeyFromHeader,
				metadata: {
					apiKeyValue: apiKeyFromHeader,
					source: 'authorization_header',
				},
			};
		}

		// Check for API key (adjust based on your API key implementation)
		const apiKey = r.apiKey;
		if (apiKey?.id) {
			return {
				type: ApiActorType.API_KEY,
				identifier: apiKey.name || apiKey.id,
				metadata: {
					apiKeyId: apiKey.id,
					apiKeyName: apiKey.name,
				},
			};
		}

		// Check for service account
		const serviceAccount = r.serviceAccount;
		if (serviceAccount?.id) {
			return {
				type: ApiActorType.SERVICE_ACCOUNT,
				identifier: serviceAccount.name || serviceAccount.id,
				metadata: {
					serviceAccountId: serviceAccount.id,
				},
			};
		}

		// No actor found
		return null;
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
		const userIdFromHeader =
			req.get('x-user-id') ||
			req.get('x-userid') ||
			req.get('user-id') ||
			req.get('x-cognito-username') ||
			req.get('x-cognito-user-id') ||
			req.get('x-aws-user-id');

		if (userIdFromHeader) {
			return {
				id: userIdFromHeader,
				email: req.get('x-user-email') || req.get('user-email') || req.get('x-cognito-email') || undefined,
				username: req.get('x-username') || req.get('username') || req.get('x-cognito-username') || undefined,
			};
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
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				return undefined;
			}

			// Decode base64url payload
			const payload = parts[1];
			const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
			const decoded = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
			const claims = JSON.parse(decoded) as Record<string, unknown>;

			// Extract user ID from common JWT claim fields
			const userId =
				(claims.sub as string) ||
				(claims['cognito:username'] as string) ||
				(claims['cognito:sub'] as string) ||
				(claims.userId as string) ||
				(claims.id as string) ||
				(claims.user_id as string) ||
				(claims.username as string) ||
				(claims.email as string);

			if (!userId) {
				// Log available claims for debugging
				this.logger.debug('JWT token found but no user ID in claims', {
					availableClaims: Object.keys(claims),
					hasSub: !!claims.sub,
					hasUsername: !!claims.username,
					hasCognitoUsername: !!claims['cognito:username'],
				});
				return undefined;
			}

			// Log successful extraction for debugging
			this.logger.debug('Extracted user from JWT token', {
				userId,
				hasEmail: !!claims.email,
				hasUsername: !!claims.username,
				hasCognitoUsername: !!claims['cognito:username'],
			});

			return {
				id: userId,
				email: (claims.email as string) || undefined,
				username:
					(claims.username as string) ||
					(claims['cognito:username'] as string) ||
					(claims.preferred_username as string) ||
					undefined,
			};
		} catch {
			// If JWT decoding fails, return undefined
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
				this.logger.debug('Request excluded by Origin header', {
					origin,
					hostname: originUrl.hostname,
					excludedOrigins,
				});
				return true;
			}
		}

		// Check Referer header
		if (referer) {
			const refererUrl = this.parseUrl(referer);
			if (refererUrl && this.isExcludedOriginMatch(refererUrl, excludedOrigins)) {
				this.logger.debug('Request excluded by Referer header', {
					referer,
					hostname: refererUrl.hostname,
					excludedOrigins,
				});
				return true;
			}
		}

		// Debug logging when not excluded
		if (process.env.NODE_ENV !== 'production') {
			this.logger.debug('Request not excluded', {
				origin,
				referer,
				excludedOrigins,
				hasOrigin: !!origin,
				hasReferer: !!referer,
			});
		}

		return false;
	}

	/**
	 * Get list of excluded origins from environment variable.
	 * Format: comma-separated list of domains (e.g., "nexus-dev.exprealty.com,app.example.com")
	 */
	private getExcludedOrigins(): string[] {
		const excluded = process.env.API_MONITORING_EXCLUDE_ORIGINS;
		if (!excluded) {
			if (process.env.NODE_ENV !== 'production') {
				this.logger.debug('API_MONITORING_EXCLUDE_ORIGINS not set');
			}
			return [];
		}
		const origins = excluded.split(',').map((domain) => domain.trim().toLowerCase());
		if (process.env.NODE_ENV !== 'production') {
			this.logger.debug('Loaded excluded origins', { origins, rawValue: excluded });
		}
		return origins;
	}

	/**
	 * Parse a URL string into a URL object.
	 * Handles URLs with or without protocol.
	 */
	private parseUrl(urlString: string): URL | null {
		try {
			// If URL already has protocol, parse directly
			if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
				return new URL(urlString);
			}
			// Otherwise, assume https
			return new URL(`https://${urlString}`);
		} catch {
			return null;
		}
	}

	/**
	 * Check if a URL matches any excluded origin.
	 */
	private isExcludedOriginMatch(url: URL, excludedOrigins: string[]): boolean {
		const hostname = url.hostname.toLowerCase();

		for (const excluded of excludedOrigins) {
			// Support exact match or subdomain match
			// e.g., "nexus-dev.exprealty.com" matches "nexus-dev.exprealty.com"
			// e.g., "nexus-dev.exprealty.com" matches "exprealty.com" (subdomain)
			if (hostname === excluded || hostname.endsWith(`.${excluded}`)) {
				return true;
			}
		}

		return false;
	}
}

