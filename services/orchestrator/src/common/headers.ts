import {
	AxiosHeaders,
	type InternalAxiosRequestConfig,
	type RawAxiosRequestHeaders,
} from 'axios'

/**
 * Safely set multiple headers on an Axios request config
 * without reassigning config.headers.
 *
 * - Works for both AxiosHeaders (v1) and plain objects.
 * - Preserves type safety and avoids TS2322 "not assignable" errors.
 */
export function setHeaders(
	config: InternalAxiosRequestConfig,
	entries: Record<string, string>,
): void {
	// Alias for convenience - config.headers is always defined in InternalAxiosRequestConfig
	const headers = config.headers as AxiosHeaders | RawAxiosRequestHeaders

	if (
		headers instanceof AxiosHeaders ||
		typeof (headers as AxiosHeaders).set === 'function'
	) {
		// Axios v1 header container
		const h = headers as AxiosHeaders
		for (const [key, value] of Object.entries(entries)) {
			h.set(key, value)
		}
	} else {
		// Plain object fallback
		const h = headers
		for (const [key, value] of Object.entries(entries)) {
			h[key] = value
		}
	}
}

/**
 * Convenience single-header setter.
 */
export function setHeader(
	config: InternalAxiosRequestConfig,
	key: string,
	value: string,
): void {
	setHeaders(config, { [key]: value })
}
