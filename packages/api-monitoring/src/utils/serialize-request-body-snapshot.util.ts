const TRUNCATION_SUFFIX = '…[truncated]';
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Serialize `req.body` (after Express/Nest parsing) to a UTF-8 string for optional persistence.
 * Returns `undefined` when there is nothing to capture.
 */
export function serializeRequestBodySnapshot(body: unknown, maxBytes: number): string | undefined {
	if (body === undefined || body === null) {
		return undefined;
	}

	if (typeof body === 'string') {
		return truncateUtf8(body, maxBytes);
	}

	if (Buffer.isBuffer(body)) {
		return truncateUtf8(`[binary Buffer ${body.length} bytes]`, maxBytes);
	}

	if (typeof body === 'object') {
		try {
			return truncateUtf8(JSON.stringify(body), maxBytes);
		} catch {
			return truncateUtf8('[unserializable object]', maxBytes);
		}
	}

	return truncateUtf8(String(body), maxBytes);
}

function truncateUtf8(s: string, maxBytes: number): string {
	const suffixBytes = Buffer.byteLength(TRUNCATION_SUFFIX, 'utf8');
	const budget = Math.max(0, maxBytes - suffixBytes);
	if (Buffer.byteLength(s, 'utf8') <= maxBytes) {
		return s;
	}

	const buf = Buffer.from(s, 'utf8');
	if (budget === 0) {
		return TRUNCATION_SUFFIX.slice(0, maxBytes);
	}

	// Shrink until we end on a complete UTF-8 codepoint and prefix + suffix fits in maxBytes.
	let end = Math.min(buf.length, budget);
	while (end > 0) {
		try {
			const prefix = utf8Decoder.decode(buf.subarray(0, end));
			const out = prefix + TRUNCATION_SUFFIX;
			if (Buffer.byteLength(out, 'utf8') <= maxBytes) {
				return out;
			}
		} catch {
			/* incomplete sequence at end */
		}
		end--;
	}

	return TRUNCATION_SUFFIX.slice(0, maxBytes);
}
