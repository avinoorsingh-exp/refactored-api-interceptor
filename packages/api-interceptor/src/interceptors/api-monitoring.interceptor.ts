import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	Inject,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';

type HttpRequest = Request & { route?: { path?: string } };

import { HttpMethod } from '../domain/api-monitoring.types.js';
import { ApiRequestContextService } from '../services/api-request-context.service.js';
import {
	API_MONITORING_MODULE_OPTIONS,
	type ApiMonitoringModuleRuntimeOptions,
} from '../tokens/api-monitoring-module-options.token.js';
import {
	API_MONITORING_ON_EXCHANGE,
	type ApiExchangeHandler,
} from '../tokens/api-monitoring-on-exchange.token.js';
import { parseSourceApplicationHeader } from '../utils/parse-source-application-header.util.js';
import { parseRetryCountHeader } from '../utils/parse-retry-count-header.util.js';
import { captureUnknownPayload } from '../utils/capture-unknown-payload.util.js';
import { byteLengthFromCapture } from '../utils/payload-byte-length.util.js';
import { buildApiExchangeSummary } from '../utils/build-api-exchange-summary.util.js';
import type {
	ApiExchangeContextSnapshot,
	ApiExchangeEvent,
	ApiExchangeRequestSnapshot,
} from '../domain/api-exchange.event.js';

/**
 * Global HTTP interceptor: captures request/response/context and notifies the host via `onApiExchange`.
 * @public
 */
@Injectable()
export class ApiMonitoringInterceptor implements NestInterceptor {
	constructor(
		private readonly contextService: ApiRequestContextService,
		@Inject(API_MONITORING_MODULE_OPTIONS)
		private readonly moduleOptions: ApiMonitoringModuleRuntimeOptions,
		@Inject(API_MONITORING_ON_EXCHANGE)
		private readonly onExchange: ApiExchangeHandler,
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<HttpRequest>();
		const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
		const startedAtMs = Date.now();

		if (this.shouldSkipMonitoring(request)) {
			const skipBodyCapture =
				this.moduleOptions.captureExchangeRequestPayload
					? captureUnknownPayload(request.body, this.moduleOptions.exchangePayloadMaxBytes)
					: undefined;
			const finishedAtMs = Date.now();
			const route = this.resolveRequestRoute(request);
			const method = this.mapHttpMethod(typeof request.method === 'string' ? request.method : 'GET');
			const sourceApplication = parseSourceApplicationHeader((name) => request.get(name));
			const retryCount = parseRetryCountHeader((name) => request.get(name));
			const summary = buildApiExchangeSummary(this.contextService, {
				route,
				method,
				statusCode: 0,
				latencyMs: finishedAtMs - startedAtMs,
				ipAddress: this.extractIpAddress(request),
				userAgent: request.get('user-agent'),
				requestSizeBytes: this.calculateRequestSize(request),
				sourceApplication,
				retryCount,
			});
			this.notifyHost({
				phase: 'skipped',
				skipReason: 'interceptor_not_tracked',
				startedAtMs,
				finishedAtMs,
				latencyMs: finishedAtMs - startedAtMs,
				request: this.buildRequestSnapshot(request, skipBodyCapture),
				context: this.buildContextSnapshot(),
				summary,
			});
			return next.handle();
		}

		this.contextService.setStartTime();
		const route = this.resolveRequestRoute(request);
		const method = this.mapHttpMethod(typeof request.method === 'string' ? request.method : 'GET');
		const ipAddress = this.extractIpAddress(request);
		const userAgent = request.get('user-agent');
		const requestSizeBytes = this.calculateRequestSize(request);
		const sourceApplication = parseSourceApplicationHeader((name) => request.get(name));
		const retryCount = parseRetryCountHeader((name) => request.get(name));
		const maxCapture = this.moduleOptions.exchangePayloadMaxBytes;
		const requestBodyCapture =
			this.moduleOptions.captureExchangeRequestPayload
				? captureUnknownPayload(request.body, maxCapture)
				: undefined;

		return next.handle().pipe(
			tap({
				next: (data: unknown) => {
					const finishedAtMs = Date.now();
					const latencyMs = finishedAtMs - startedAtMs;
					const httpStatus =
						typeof response.statusCode === 'number' && Number.isFinite(response.statusCode)
							? response.statusCode
							: 500;

					const responseBodyCapture =
						this.moduleOptions.captureExchangeResponsePayload
							? captureUnknownPayload(data, maxCapture)
							: undefined;

					const responseSizeBytes =
						byteLengthFromCapture(responseBodyCapture) ?? this.calculateResponseSizeLegacy(data);

					const summary = buildApiExchangeSummary(this.contextService, {
						route,
						method,
						statusCode: httpStatus,
						latencyMs,
						ipAddress,
						userAgent,
						requestSizeBytes,
						responseSizeBytes,
						sourceApplication,
						retryCount,
					});

					this.notifyHost({
						phase: 'completed',
						startedAtMs,
						finishedAtMs,
						latencyMs,
						request: this.buildRequestSnapshot(request, requestBodyCapture),
						context: this.buildContextSnapshot(),
						response: {
							httpStatus,
							responseSizeBytes,
							body: responseBodyCapture,
						},
						summary,
					});
				},
			}),
			catchError((err: unknown) => {
				const finishedAtMs = Date.now();
				const latencyMs = finishedAtMs - startedAtMs;
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

				const errorCapture = captureUnknownPayload(err, maxCapture);

				const summary = buildApiExchangeSummary(this.contextService, {
					route,
					method,
					statusCode,
					latencyMs,
					ipAddress,
					userAgent,
					error: err,
					requestSizeBytes,
					sourceApplication,
					retryCount,
				});

				this.notifyHost({
					phase: 'error',
					startedAtMs,
					finishedAtMs,
					latencyMs,
					request: this.buildRequestSnapshot(request, requestBodyCapture),
					context: this.buildContextSnapshot(),
					response: { httpStatus: statusCode },
					error: errorCapture,
					summary,
				});

				return throwError(() => err);
			}),
		);
	}

	private notifyHost(event: ApiExchangeEvent): void {
		void Promise.resolve(this.onExchange(event)).catch(() => {
			/* intentional: host hook must not affect the HTTP pipeline */
		});
	}

	private buildRequestSnapshot(
		request: HttpRequest,
		bodyCapture?: ReturnType<typeof captureUnknownPayload>,
	): ApiExchangeRequestSnapshot {
		const route = this.resolveRequestRoute(request);
		const method = typeof request.method === 'string' ? request.method : 'GET';
		const snap: ApiExchangeRequestSnapshot = {
			route,
			method,
			path: typeof request.path === 'string' ? request.path : '/',
			originalUrl: typeof request.originalUrl === 'string' ? request.originalUrl : undefined,
			query: request.query,
			headers: { ...request.headers },
			ipAddress: this.extractIpAddress(request),
			userAgent: request.get('user-agent'),
			requestSizeBytes: this.calculateRequestSize(request),
		};
		if (bodyCapture) {
			snap.body = bodyCapture;
		}
		return snap;
	}

	private buildContextSnapshot(): ApiExchangeContextSnapshot {
		const ctx = this.contextService.getContext();
		return {
			correlationId: this.contextService.getCorrelationId() ?? ctx?.correlationId,
			timestamp: ctx?.timestamp,
			actorId: ctx?.actorId,
			actorType: ctx?.actorType,
			monitoringUserId: ctx?.monitoringUserId,
		};
	}

	private resolveRequestRoute(request: HttpRequest): string {
		const layer: unknown = request.route;
		const pathCandidate =
			layer && typeof layer === 'object' && 'path' in layer ? layer.path : undefined;
		if (typeof pathCandidate === 'string' && pathCandidate.length > 0) {
			return pathCandidate;
		}
		const p = request.path;
		if (typeof p === 'string' && p.length > 0) {
			return p;
		}
		return '/';
	}

	private mapHttpMethod(method: string): HttpMethod {
		const upperMethod = method.toUpperCase();
		return Object.values(HttpMethod).includes(upperMethod as HttpMethod)
			? (upperMethod as HttpMethod)
			: HttpMethod.GET;
	}

	private shouldSkipMonitoring(request: Request): boolean {
		const ipAddress = this.extractIpAddress(request);
		if (ipAddress && this.isLocalhostOrInternal(ipAddress)) {
			return true;
		}

		const excludedOrigins = this.getExcludedOrigins();
		if (excludedOrigins.length > 0) {
			const origin = request.get('origin');
			const referer = request.get('referer');

			if (origin) {
				const originUrl = this.parseUrl(origin);
				if (originUrl && this.isExcludedOrigin(originUrl, excludedOrigins)) {
					return true;
				}
			}

			if (referer) {
				const refererUrl = this.parseUrl(referer);
				if (refererUrl && this.isExcludedOrigin(refererUrl, excludedOrigins)) {
					return true;
				}
			}
		}

		return false;
	}

	private getExcludedOrigins(): string[] {
		const excluded = process.env.API_MONITORING_EXCLUDE_ORIGINS;
		if (!excluded) {
			return [];
		}
		return excluded.split(',').map((domain) => domain.trim().toLowerCase());
	}

	private isExcludedOrigin(url: URL, excludedOrigins: string[]): boolean {
		const hostname = url.hostname.toLowerCase();

		for (const excluded of excludedOrigins) {
			if (hostname === excluded || hostname.endsWith(`.${excluded}`) || hostname.includes(excluded)) {
				return true;
			}
		}

		return false;
	}

	private parseUrl(urlString: string): URL | null {
		try {
			if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
				return new URL(urlString);
			}
			return new URL(`https://${urlString}`);
		} catch {
			return null;
		}
	}

	private isLocalhostOrInternal(ip: string): boolean {
		const cleanIp = ip.replace(/^\[|\]$/g, '');

		if (cleanIp === 'localhost' || cleanIp === '127.0.0.1' || cleanIp === '::1') {
			return true;
		}

		const ipv4PrivateRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
		if (ipv4PrivateRegex.test(cleanIp)) {
			return true;
		}

		if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fe80:')) {
			return true;
		}

		return false;
	}

	private extractIpAddress(request: Request): string | undefined {
		const forwardedFor = request.get('x-forwarded-for');
		if (forwardedFor) {
			const ips = forwardedFor.split(',').map((ip) => ip.trim());
			return ips[0];
		}

		const realIp = request.get('x-real-ip');
		if (realIp) {
			return realIp;
		}

		return request.ip || request.socket.remoteAddress;
	}

	private calculateRequestSize(request: Request): number | undefined {
		if (request.body) {
			try {
				const bodyString = JSON.stringify(request.body);
				return Buffer.byteLength(bodyString, 'utf8');
			} catch {
				/* ignore */
			}
		}

		const contentLength = request.get('content-length');
		if (contentLength) {
			return parseInt(contentLength, 10);
		}

		return undefined;
	}

	private calculateResponseSizeLegacy(data: unknown): number | undefined {
		if (data === null || data === undefined) {
			return 0;
		}

		try {
			const dataString = JSON.stringify(data);
			return Buffer.byteLength(dataString, 'utf8');
		} catch {
			return undefined;
		}
	}
}
