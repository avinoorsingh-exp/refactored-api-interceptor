/**
 * Returns the string if it is a valid UUID (RFC 4122 shape), else `undefined`.
 * Used to populate `user_uuid` when the external id is uuid-shaped.
 */
export function tryParseUuidString(value: string): string | undefined {
	const t = value.trim();
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
	) {
		return undefined;
	}
	return t;
}
