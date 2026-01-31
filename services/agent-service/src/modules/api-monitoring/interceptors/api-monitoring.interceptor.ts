import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';
import { HttpMethod } from '@exprealty/shared-domain';
import { shouldLogApiRequest } from '@exprealty/api-monitoring';
import { ApiMonitoringService } from '../services/api-monitoring.service.js';
import { ApiRequestContextService } from '../services/api-request-context.service.js';

/**
 * HTTP Interceptor for API request monitoring.
 * 
 * Captures request/response metadata and logs it asynchronously.
 * This interceptor:
 * - Measures request latency
 * - Captures status codes and errors
 * - Logs requests in background (non-blocking)
 * - Never throws errors that could affect request lifecycle
 * 
 * @public
 */
@Injectable()
export class ApiMonitoringInterceptor implements NestInterceptor {
	constructor(
		private readonly monitoringService: ApiMonitoringService,
		private readonly contextService: ApiRequestContextService,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();

		// Policy: Skip monitoring if request should not be logged
		// This prevents development and internal UI traffic from polluting production API monitoring data
		if (!shouldLogApiRequest(request)) {
			return next.handle();
		}

		// CRITICAL: Skip logging if no actor is present
		// If there is no actor, there should be NO route requests logged
		// @ts-expect-error - apiActor is attached by middleware
		if (!request.apiActor || !request.apiActor.id) {
			// No actor = no logging. Silently skip this request.
			return next.handle();
		}

		// Set start time for latency calculation
		this.contextService.setStartTime();
		const startTime = Date.now();

		// Extract request metadata
		const route = request.route?.path || request.path;
		const method = this.mapHttpMethod(request.method);
		const ipAddress = this.extractIpAddress(request);
		const userAgent = request.get('user-agent');

		// Calculate request size (if available)
		const requestSizeBytes = this.calculateRequestSize(request);

		return next.handle().pipe(
			tap({
				next: (data) => {
					// Success case
					const latencyMs = Date.now() - startTime;
					const responseSizeBytes = this.calculateResponseSize(data);

					const metadata = this.monitoringService.buildRequestMetadata(
						route,
						method,
						response.statusCode,
						latencyMs,
						ipAddress,
						userAgent,
						undefined, // no error
						requestSizeBytes,
						responseSizeBytes,
					);

					// Log asynchronously (non-blocking)
					this.monitoringService.logRequest(metadata).catch(() => {
						// Errors are already logged in the service
					});
				},
			}),
			catchError((error) => {
				// Error case
				const latencyMs = Date.now() - startTime;
				const statusCode = error?.status || response.statusCode || 500;

				const metadata = this.monitoringService.buildRequestMetadata(
					route,
					method,
					statusCode,
					latencyMs,
					ipAddress,
					userAgent,
					error,
					requestSizeBytes,
					undefined, // response size not available on error
				);

				// Log asynchronously (non-blocking)
				this.monitoringService.logRequest(metadata).catch(() => {
					// Errors are already logged in the service
				});

				// Re-throw error to maintain normal error handling
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Map Express method to HttpMethod enum.
	 */
	private mapHttpMethod(method: string): HttpMethod {
		const upperMethod = method.toUpperCase();
		return Object.values(HttpMethod).includes(upperMethod as HttpMethod)
			? (upperMethod as HttpMethod)
			: HttpMethod.GET;
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
			return ips[0];
		}

		// Check X-Real-IP header
		const realIp = request.get('x-real-ip');
		if (realIp) {
			return realIp;
		}

		// Fall back to request IP
		return request.ip || request.socket.remoteAddress;
	}

	/**
	 * Calculate request body size in bytes.
	 */
	private calculateRequestSize(request: Request): number | undefined {
		if (request.body) {
			try {
				const bodyString = JSON.stringify(request.body);
				return Buffer.byteLength(bodyString, 'utf8');
			} catch {
				// Ignore errors
			}
		}

		const contentLength = request.get('content-length');
		if (contentLength) {
			return parseInt(contentLength, 10);
		}

		return undefined;
	}

	/**
	 * Calculate response body size in bytes.
	 */
	private calculateResponseSize(data: unknown): number | undefined {
		if (data === null || data === undefined) {
			return 0;
		}

		try {
			const dataString = JSON.stringify(data);
			return Buffer.byteLength(dataString, 'utf8');
		} catch {
			// Ignore errors
			return undefined;
		}
	}
}

