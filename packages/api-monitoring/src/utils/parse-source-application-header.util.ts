/**
 * HTTP header used by upstream clients (e.g. IMS, TRX) to identify which application
 * initiated the proxied API call. Read by {@link ApiMonitoringInterceptor}.
 *
 * @public
 */
export const API_MONITORING_SOURCE_APP_HEADER = 'x-source-app';

const MAX_SOURCE_APPLICATION_LENGTH = 64;

/**
 * Returns a normalized source application label from `x-source-app`, or `undefined` if absent/blank.
 * Values are trimmed and capped at {@link MAX_SOURCE_APPLICATION_LENGTH} UTF-16 code units.
 *
 * @public
 */
export function parseSourceApplicationHeader(
	getHeader: (name: string) => string | undefined,
): string | undefined {
	const raw = getHeader(API_MONITORING_SOURCE_APP_HEADER);
	if (raw === undefined) {
		return undefined;
	}
	const trimmed = raw.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.length > MAX_SOURCE_APPLICATION_LENGTH
		? trimmed.slice(0, MAX_SOURCE_APPLICATION_LENGTH)
		: trimmed;
}
