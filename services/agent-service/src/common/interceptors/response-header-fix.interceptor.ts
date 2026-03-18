import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor to fix conflicting Content-Length and Transfer-Encoding headers.
 * 
 * This is a backup safety mechanism that runs after route handlers complete.
 * The main fix is in main.ts middleware, but this ensures headers are normalized
 * even if something bypasses the middleware.
 * 
 * When compression middleware sets Transfer-Encoding: chunked, Express/NestJS
 * may also set Content-Length, which is invalid HTTP and causes browsers/axios
 * to abort the connection.
 * 
 * This interceptor ensures only ONE of these headers is present:
 * - If Transfer-Encoding is present, remove Content-Length
 * - Transfer-Encoding takes precedence (preferred for chunked responses)
 */
@Injectable()
export class ResponseHeaderFixInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const response = context.switchToHttp().getResponse<Response>();

		return next.handle().pipe(
			tap(() => {
				// Fix headers after handler completes but before response is sent
				// This is a safety check - main fix is in middleware
				if (!response.headersSent && !response.finished) {
					const transferEncoding = response.getHeader('transfer-encoding');
					const contentLength = response.getHeader('content-length');

					if (transferEncoding && contentLength) {
						// Transfer-Encoding takes precedence - remove Content-Length
						try {
							response.removeHeader('content-length');
							// Also remove from internal headers object if it exists
							if ((response as any)._headers) {
								delete (response as any)._headers['content-length'];
								delete (response as any)._headers['Content-Length'];
							}
							if ((response as any)._headerNames) {
								delete (response as any)._headerNames['content-length'];
								delete (response as any)._headerNames['Content-Length'];
							}
							if ((response as any)._removedHeader) {
								(response as any)._removedHeader['content-length'] = true;
								(response as any)._removedHeader['Content-Length'] = true;
							}
						} catch (e) {
							// Ignore errors if headers are already sent
						}
					}
				}
			}),
		);
	}
}

