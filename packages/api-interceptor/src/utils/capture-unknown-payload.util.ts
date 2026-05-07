import type { ApiCapturedPayload } from '../domain/api-exchange.event.js';

const TRUNCATION_SUFFIX = '…[truncated]';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function truncateUtf8(s: string, maxBytes: number): { text: string; truncated: boolean } {
	const suffixBytes = Buffer.byteLength(TRUNCATION_SUFFIX, 'utf8');
	const budget = Math.max(0, maxBytes - suffixBytes);
	const fullLen = Buffer.byteLength(s, 'utf8');
	if (fullLen <= maxBytes) {
		return { text: s, truncated: false };
	}
	const buf = Buffer.from(s, 'utf8');
	let end = Math.min(buf.length, budget);
	while (end > 0) {
		try {
			const prefix = utf8Decoder.decode(buf.subarray(0, end));
			const out = prefix + TRUNCATION_SUFFIX;
			if (Buffer.byteLength(out, 'utf8') <= maxBytes) {
				return { text: out, truncated: true };
			}
		} catch {
			/* incomplete sequence */
		}
		end--;
	}
	return { text: TRUNCATION_SUFFIX.slice(0, maxBytes), truncated: true };
}

function safeJsonStringify(value: unknown): { ok: true; text: string } | { ok: false } {
	try {
		const seen = new WeakSet<object>();
		const text = JSON.stringify(value, (_k, v: unknown) => {
			if (typeof v === 'bigint') {
				return v.toString();
			}
			if (typeof v === 'object' && v !== null) {
				const o = v;
				if (seen.has(o)) {
					return '[Circular]';
				}
				seen.add(o);
			}
			return v;
		});
		return { ok: true, text };
	} catch {
		return { ok: false };
	}
}

function isNodeReadable(value: unknown): boolean {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const v = value as Record<string, unknown>;
	return typeof v.pipe === 'function' && typeof v.read === 'function';
}

function isWebReadableStream(value: unknown): boolean {
	return (
		typeof ReadableStream !== 'undefined' &&
		value instanceof ReadableStream
	);
}

function toUint8View(value: ArrayBuffer | SharedArrayBuffer): Uint8Array {
	return new Uint8Array(value);
}

/**
 * Turns any runtime value into a bounded, JSON-friendly description for host consumers.
 * Binary values expose a base64 prefix; streams are labeled only (bytes are not consumed).
 */
export function captureUnknownPayload(value: unknown, maxBytes: number): ApiCapturedPayload {
	if (value === undefined || value === null) {
		return { kind: 'empty' };
	}

	if (value instanceof Error) {
		return {
			kind: 'error',
			name: value.name,
			message: value.message,
			stack: value.stack ? truncateUtf8(value.stack, maxBytes).text : undefined,
		};
	}

	if (typeof value === 'string') {
		const { text, truncated } = truncateUtf8(value, maxBytes);
		return { kind: 'string', text, byteLength: Buffer.byteLength(text, 'utf8'), truncated };
	}

	if (typeof value === 'number') {
		return { kind: 'primitive', primitiveType: 'number', display: String(value) };
	}
	if (typeof value === 'boolean') {
		return { kind: 'primitive', primitiveType: 'boolean', display: String(value) };
	}

	if (typeof value === 'bigint') {
		return { kind: 'primitive', primitiveType: 'bigint', display: value.toString() };
	}

	if (typeof value === 'symbol') {
		return {
			kind: 'primitive',
			primitiveType: 'symbol',
			display: value.description ?? value.toString(),
		};
	}

	if (typeof value === 'function') {
		const name = value.name || 'anonymous';
		return { kind: 'function', name, display: `[Function ${name}]` };
	}

	if (Buffer.isBuffer(value)) {
		return binaryCapture('buffer', value.length, value, maxBytes);
	}

	if (value instanceof Uint8Array) {
		return binaryCapture('uint8array', value.byteLength, value, maxBytes);
	}

	if (value instanceof ArrayBuffer) {
		const u8 = toUint8View(value);
		return binaryCapture('arraybuffer', u8.byteLength, u8, maxBytes);
	}

	if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
		const u8 = new Uint8Array(value);
		return binaryCapture('arraybuffer', u8.byteLength, u8, maxBytes);
	}

	if (isWebReadableStream(value)) {
		return {
			kind: 'stream',
			variant: 'web-readablestream',
			note: 'Web ReadableStream (body not read by interceptor)',
		};
	}

	if (isNodeReadable(value)) {
		return {
			kind: 'stream',
			variant: 'nodejs-readable',
			note: 'Node.js Readable stream (body not read by interceptor)',
		};
	}

	if (value instanceof Date) {
		const iso = value.toISOString();
		const { text, truncated } = truncateUtf8(iso, maxBytes);
		return { kind: 'string', text, byteLength: Buffer.byteLength(text, 'utf8'), truncated };
	}

	if (value instanceof RegExp) {
		return {
			kind: 'special-object',
			objectKind: 'RegExp',
			detail: value.toString(),
		};
	}

	if (value instanceof Map) {
		const attempted = safeJsonStringify(Array.from(value.entries()));
		if (attempted.ok) {
			const { text, truncated } = truncateUtf8(attempted.text, maxBytes);
			let parsed: unknown = text;
			if (!truncated) {
				try {
					parsed = JSON.parse(text) as unknown;
				} catch {
					parsed = text;
				}
			}
			return {
				kind: 'json',
				value: parsed,
				json: text,
				byteLength: Buffer.byteLength(text, 'utf8'),
				truncated,
			};
		}
		return { kind: 'special-object', objectKind: 'Map', detail: `[Map size=${value.size}]` };
	}

	if (value instanceof Set) {
		const attempted = safeJsonStringify(Array.from(value.values()));
		if (attempted.ok) {
			const { text, truncated } = truncateUtf8(attempted.text, maxBytes);
			let parsed: unknown = text;
			if (!truncated) {
				try {
					parsed = JSON.parse(text) as unknown;
				} catch {
					parsed = text;
				}
			}
			return {
				kind: 'json',
				value: parsed,
				json: text,
				byteLength: Buffer.byteLength(text, 'utf8'),
				truncated,
			};
		}
		return { kind: 'special-object', objectKind: 'Set', detail: `[Set size=${value.size}]` };
	}

	if (typeof value === 'object') {
		const jsonTry = safeJsonStringify(value);
		if (jsonTry.ok) {
			const { text, truncated } = truncateUtf8(jsonTry.text, maxBytes);
			let parsed: unknown = text;
			if (!truncated) {
				try {
					parsed = JSON.parse(text) as unknown;
				} catch {
					parsed = text;
				}
			}
			return {
				kind: 'json',
				value: parsed,
				json: text,
				byteLength: Buffer.byteLength(text, 'utf8'),
				truncated,
			};
		}
		const protoCtor = value.constructor;
		const ctorName =
			typeof protoCtor === 'function' &&
			'name' in protoCtor &&
			typeof (protoCtor as { name?: string }).name === 'string'
				? (protoCtor as { name: string }).name
				: 'Object';
		return {
			kind: 'special-object',
			objectKind: ctorName,
			detail: Object.prototype.toString.call(value),
		};
	}

	return {
		kind: 'special-object',
		objectKind: 'unknown',
		detail: Object.prototype.toString.call(value),
	};
}

function binaryCapture(
	encoding: 'buffer' | 'uint8array' | 'arraybuffer',
	totalBytes: number,
	bytes: Uint8Array,
	maxBytes: number,
): ApiCapturedPayload {
	// Budget: base64 expands ~4/3; cap raw preview so base64 fits in maxBytes for the JSON event.
	const maxRaw = Math.max(1, Math.floor((maxBytes * 3) / 4));
	const previewBytes = Math.min(totalBytes, maxRaw);
	const slice = bytes.subarray(0, previewBytes);
	const base64Preview = Buffer.from(slice).toString('base64');
	return {
		kind: 'binary',
		encoding,
		totalBytes,
		base64Preview,
		previewBytes,
		truncated: previewBytes < totalBytes,
	};
}
