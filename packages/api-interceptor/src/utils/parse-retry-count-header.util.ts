/**
 * HTTP header for **manual or automated replays** of a failed API call. The value is the
 * **retry count** for this invocation: **0** = original attempt (or header omitted), **1** = first replay, etc.
 *
 * @public
 */
export const API_INTERCEPTOR_RETRY_COUNT_HEADER = 'x-retry-count';

const MAX_RETRY_COUNT = 10_000;

/**
 * Parses `x-retry-count` as a non-negative integer. Returns **0** if the header is missing,
 * blank, or not a valid integer. Values above {@link MAX_RETRY_COUNT} are clamped.
 *
 * @public
 */
export function parseRetryCountHeader(getHeader: (name: string) => string | undefined): number {
	const raw = getHeader(API_INTERCEPTOR_RETRY_COUNT_HEADER);
	if (raw === undefined) {
		return 0;
	}
	const trimmed = raw.trim();
	if (!trimmed) {
		return 0;
	}
	const n = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(n) || n < 0) {
		return 0;
	}
	return n > MAX_RETRY_COUNT ? MAX_RETRY_COUNT : n;
}
