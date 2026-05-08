/**
 * HTTP exchange snapshot delivered to the host via `onApiExchange` in {@link ApiInterceptorModule.forRoot}.
 * @public
 */

import type { Request } from 'express';
import type { ApiActorType, ApiErrorClassification, HttpMethod } from './api-interceptor.types.js';

/** Structural capture of any JavaScript value (request/response bodies, errors). */
export type ApiCapturedPayload =
	| { kind: 'empty' }
	| {
			kind: 'json';
			value: unknown;
			json: string;
			byteLength: number;
			truncated: boolean;
	  }
	| {
			kind: 'string';
			text: string;
			byteLength: number;
			truncated: boolean;
	  }
	| {
			kind: 'binary';
			encoding: 'buffer' | 'uint8array' | 'arraybuffer';
			totalBytes: number;
			base64Preview: string;
			previewBytes: number;
			truncated: boolean;
	  }
	| {
			kind: 'stream';
			variant: 'nodejs-readable' | 'web-readablestream' | 'unknown-stream';
			note: string;
	  }
	| {
			kind: 'primitive';
			primitiveType: 'number' | 'boolean' | 'bigint' | 'symbol' | 'undefined';
			display: string;
	  }
	| {
			kind: 'function';
			name: string;
			display: string;
	  }
	| {
			kind: 'special-object';
			objectKind: string;
			detail?: string;
			fallbackJson?: string;
	  }
	| {
			kind: 'error';
			name?: string;
			message?: string;
			stack?: string;
	  };

export interface ApiExchangeRequestSnapshot {
	route: string;
	method: string;
	path: string;
	originalUrl?: string;
	query: Request['query'];
	headers: Record<string, string | string[] | undefined>;
	ipAddress?: string;
	userAgent?: string;
	requestSizeBytes?: number;
	body?: ApiCapturedPayload;
}

export interface ApiExchangeResponseSnapshot {
	httpStatus: number;
	responseSizeBytes?: number;
	body?: ApiCapturedPayload;
}

export interface ApiExchangeContextSnapshot {
	correlationId?: string;
	timestamp?: number;
	actorId?: string;
	actorType?: string;
	monitoringUserId?: string;
}

/** Flattened request/response facts plus async context (for analytics, logging, or forwarding). */
export interface ApiExchangeSummary {
	route: string;
	method: HttpMethod;
	statusCode: number;
	latencyMs: number;
	requestSizeBytes?: number;
	responseSizeBytes?: number;
	ipAddress?: string;
	userAgent?: string;
	correlationId: string;
	timestamp: Date;
	actorId?: string;
	actorType?: ApiActorType;
	monitoringUserId?: string;
	errorClassification?: ApiErrorClassification;
	hasError: boolean;
	errorMessage?: string;
	stackTrace?: string;
	sourceApplication?: string;
	retryCount?: number;
}

export interface ApiExchangeEvent {
	phase: 'completed' | 'error' | 'skipped';
	skipReason?: string;
	startedAtMs: number;
	finishedAtMs: number;
	latencyMs: number;
	request: ApiExchangeRequestSnapshot;
	context: ApiExchangeContextSnapshot;	//Stuff from your async store (e.g. correlation id, actor)
	response?: ApiExchangeResponseSnapshot;
	error?: ApiCapturedPayload;
	summary: ApiExchangeSummary;
}
// phase
// Did it finish OK, error out, or get skipped?
// timing
// When it started/ended and how long it took
// request
// Method, path, headers, optional body snapshot
// response
// Status code, optional body snapshot (if there was a normal response)
// error
// If something threw, a structured snapshot of that error
// context
// Stuff from your async store (e.g. correlation id, actor)
// summary
// A shorter “dashboard row” version of the same story (good for logs/metrics)