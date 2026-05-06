import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';

type HttpRequest = Request & { route?: { path?: string } };
import { HttpMethod } from '../domain/api-monitoring.types.js';
import { ApiMonitoringService } from '../services/api-monitoring.service.js';
import { ApiRequestContextService } from '../services/api-request-context.service.js';
import {
	API_MONITORING_MODULE_OPTIONS,
	type ApiMonitoringModuleRuntimeOptions,
} from '../tokens/api-monitoring-module-options.token.js';
import { serializeRequestBodySnapshot } from '../utils/serialize-request-body-snapshot.util.js';
import { parseSourceApplicationHeader } from '../utils/parse-source-application-header.util.js';
import { parseRetryCountHeader } from '../utils/parse-retry-count-header.util.js';

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
		@Inject(API_MONITORING_MODULE_OPTIONS)
		private readonly moduleOptions: ApiMonitoringModuleRuntimeOptions,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<HttpRequest>();
		const response = context.switchToHttp().getResponse<Response>();

		// Skip monitoring for localhost/internal requests if configured
		if (this.shouldSkipMonitoring(request)) {
			return next.handle();
		}

		// Set start time for latency calculation
		this.contextService.setStartTime();
		const startTime = Date.now();

		// Extract request metadata
		const route = this.resolveRequestRoute(request);
		const method = this.mapHttpMethod(typeof request.method === 'string' ? request.method : 'GET');
		const ipAddress = this.extractIpAddress(request);
		const userAgent = request.get('user-agent');

		// Calculate request size (if available)
		const requestSizeBytes = this.calculateRequestSize(request);

		const requestBodySnapshot =
			this.moduleOptions.captureRequestBody
				? serializeRequestBodySnapshot(request.body, this.moduleOptions.requestBodyMaxBytes)
				: undefined;

		const sourceApplication = parseSourceApplicationHeader((name) => request.get(name));
		const retryCount = parseRetryCountHeader((name) => request.get(name));

		return next.handle().pipe(
			tap({
				next: (data: unknown) => {
					// Success case
					const latencyMs = Date.now() - startTime;
					const responseSizeBytes = this.calculateResponseSize(data);

					const httpStatus =
						typeof response.statusCode === 'number' && Number.isFinite(response.statusCode)
							? response.statusCode
							: 500;

					const metadata = this.monitoringService.buildRequestMetadata(
						route,
						method,
						httpStatus,
						latencyMs,
						ipAddress,
						userAgent,
						undefined, // no error
						requestSizeBytes,
						responseSizeBytes,
						requestBodySnapshot,
						sourceApplication,
						retryCount,
					);

					// Log asynchronously (non-blocking)
					this.monitoringService.logRequest(metadata).catch(() => {
						// Errors are already logged in the service
					});
				},
			}),
			catchError((err: unknown) => {
				// Error case
				const latencyMs = Date.now() - startTime;
				let statusCode =
					typeof response.statusCode === 'number' && Number.isFinite(response.statusCode)
						? response.statusCode
						: 500;
				if (typeof err === 'object' && err !== null && 'status' in err) {
					const s = (err as { status?: unknown }).status;
					if (typeof s === 'number') {
						statusCode = s;
					}
				}

				const metadata = this.monitoringService.buildRequestMetadata(
					route,
					method,
					statusCode,
					latencyMs,
					ipAddress,
					userAgent,
					err,
					requestSizeBytes,
					undefined, // response size not available on error
					requestBodySnapshot,
					sourceApplication,
					retryCount,
				);

				// Log asynchronously (non-blocking)
				this.monitoringService.logRequest(metadata).catch(() => {
					// Errors are already logged in the service
				});

				// Re-throw error to maintain normal error handling
				return throwError(() => err);
			}),
		);
	}

	private resolveRequestRoute(request: HttpRequest): string {
		const layer: unknown = request.route;
		const pathCandidate =
			layer && typeof layer === 'object' && 'path' in layer
				? (layer).path
				: undefined;
		if (typeof pathCandidate === 'string' && pathCandidate.length > 0) {
			return pathCandidate;
		}
		const p = request.path;
		if (typeof p === 'string' && p.length > 0) {
			return p;
		}
		return '/';
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
	 * 
	 * Skips:
	 * - Localhost/internal requests (always)
	 * - Frontend UI requests (configurable via API_MONITORING_EXCLUDE_ORIGINS)
	 * 
	 * Only tracks external API requests from non-excluded origins.
	 */
	private shouldSkipMonitoring(request: Request): boolean {
		// Always skip localhost/internal IP requests
		const ipAddress = this.extractIpAddress(request);
		if (ipAddress && this.isLocalhostOrInternal(ipAddress)) {
			return true;
		}

		// Check if request is from an excluded origin (frontend UI, etc.)
		const excludedOrigins = this.getExcludedOrigins();
		if (excludedOrigins.length > 0) {
			const origin = request.get('origin');
			const referer = request.get('referer');
			
			// Check Origin header
			if (origin) {
				const originUrl = this.parseUrl(origin);
				if (originUrl && this.isExcludedOrigin(originUrl, excludedOrigins)) {
					return true;
				}
			}
			
			// Check Referer header
			if (referer) {
				const refererUrl = this.parseUrl(referer);
				if (refererUrl && this.isExcludedOrigin(refererUrl, excludedOrigins)) {
					return true;
				}
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
	private isExcludedOrigin(url: URL, excludedOrigins: string[]): boolean {
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
			// (the original client IP, before proxies)
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

