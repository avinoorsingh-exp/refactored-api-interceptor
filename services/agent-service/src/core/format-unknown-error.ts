import { z } from 'zod'

/**
 * Node's console.error uses util.inspect, which can throw on some thrown values (e.g. ZodError shape on certain Node versions).
 * Prefer logging the string from this helper instead of passing unknown errors as console's extra object args.
 */
export function formatUnknownError(err: unknown): string {
	if (err instanceof z.ZodError) {
		try {
			return `${err.message}\n${JSON.stringify(err.flatten(), null, 2)}`
		} catch {
			return err.message
		}
	}
	if (err instanceof Error) {
		return err.stack ?? `${err.name}: ${err.message}`
	}
	if (typeof err === 'string') {
		return err
	}
	try {
		return JSON.stringify(err, null, 2)
	} catch {
		return String(err)
	}
}
