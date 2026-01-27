import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiActorType } from '@exprealty/shared-domain';
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

	async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
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
			} else {
				// Anonymous request
				const anonymousActor = await this.actorService.getOrCreateActor(
					ApiActorType.ANONYMOUS,
					undefined,
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
		// Check for authenticated user (adjust based on your auth implementation)
		// @ts-expect-error - user may be set by auth middleware
		const user = req.user;
		if (user?.id) {
			return {
				type: ApiActorType.USER,
				identifier: user.email || user.username || user.id,
				metadata: {
					userId: user.id,
					username: user.username,
				},
			};
		}

		// Check for API key (adjust based on your API key implementation)
		// @ts-expect-error - apiKey may be set by auth middleware
		const apiKey = req.apiKey;
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
		// @ts-expect-error - serviceAccount may be set by auth middleware
		const serviceAccount = req.serviceAccount;
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
}

