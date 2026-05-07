import type { ApiCapturedPayload } from '../domain/api-exchange.event.js';

/** Best-effort serialized size implied by a capture (for metrics / DB `response_size_bytes`). */
export function byteLengthFromCapture(payload: ApiCapturedPayload | undefined): number | undefined {
	if (!payload) {
		return undefined;
	}
	switch (payload.kind) {
		case 'empty':
			return 0;
		case 'json':
			return payload.byteLength;
		case 'string':
			return payload.byteLength;
		case 'binary':
			return payload.totalBytes;
		case 'error':
			return payload.stack
				? Buffer.byteLength(`${payload.name ?? ''}${payload.message ?? ''}${payload.stack}`, 'utf8')
				: Buffer.byteLength(`${payload.name ?? ''}${payload.message ?? ''}`, 'utf8');
		default:
			return undefined;
	}
}
