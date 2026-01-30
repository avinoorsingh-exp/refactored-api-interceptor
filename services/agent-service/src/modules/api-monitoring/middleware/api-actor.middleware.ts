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
	 * 2. API key (apiKey.id)
	 * 3. Service account (serviceAccount.id)
	 * 4. Local dev fallback (LOCAL_DEV_ACTOR) - if NODE_ENV !== 'production'
	 * 5. Anonymous fallback (ANONYMOUS) - production-safe
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

		// Priority 2: API key
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

		// Priority 3: Service account
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

		// Priority 4: Local development fallback
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

		// Priority 5: Anonymous fallback (production-safe)
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
}

