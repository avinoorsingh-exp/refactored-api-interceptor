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

		// Skip monitoring for localhost/internal requests
		if (this.shouldSkipMonitoring(request)) {
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
	 * Check if monitoring should be skipped for this request.
	 * Skips localhost/internal requests.
	 */
	private shouldSkipMonitoring(request: Request): boolean {
		const ipAddress = this.extractIpAddress(request);
		if (ipAddress && this.isLocalhostOrInternal(ipAddress)) {
			return true;
		}
		return false;
	}

	/**
	 * Check if an IP address is localhost or internal/private.
	 */
	private isLocalhostOrInternal(ip: string): boolean {
		// Remove IPv6 brackets if present
		const cleanIp = ip.replace(/^\[|\]$/g, '');
		
		// Check for localhost
		if (cleanIp === 'localhost' || cleanIp === '127.0.0.1' || cleanIp === '::1') {
			return true;
		}

		// Check for private/internal IP ranges
		// IPv4 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
		const ipv4PrivateRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
		if (ipv4PrivateRegex.test(cleanIp)) {
			return true;
		}

		// IPv6 private ranges: fc00::/7, fe80::/10
		if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fe80:')) {
			return true;
		}

		return false;
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

