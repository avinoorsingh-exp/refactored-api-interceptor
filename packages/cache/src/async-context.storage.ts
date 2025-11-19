import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

/**
 * Request context stored in AsyncLocalStorage
 * Contains correlation ID and optional request metadata
 */
export interface RequestContext {
	correlationId: string
	userId?: string
	requestPath?: string
	method?: string
	ip?: string
	timestamp: number
}

/**
 * AsyncLocalStorage-based context storage for request-scoped data.
 * Provides correlation ID tracking across async operations.
 * 
 * This can later be extended to use Redis for distributed tracing.
 * 
 * @example
 * ```ts
 * // In middleware
 * AsyncContextStorage.run({ correlationId: 'abc-123', timestamp: Date.now() }, () => {
 *   // Correlation ID is available in nested async calls
 *   const id = AsyncContextStorage.getCorrelationId()
 * })
 * ```
 */
export class AsyncContextStorage {
	private static storage = new AsyncLocalStorage<RequestContext>()

	/**
	 * Get the current request context store
	 * @returns The current RequestContext or undefined if not in a context
	 */
	static getStore(): RequestContext | undefined {
		return this.storage.getStore()
	}

	/**
	 * Run a callback within a new request context
	 * @param context - The request context to set
	 * @param callback - The callback to run within the context
	 * @returns The result of the callback
	 */
	static run<T>(context: RequestContext, callback: () => T): T {
		return this.storage.run(context, callback)
	}

	/**
	 * Get the correlation ID from the current context
	 * @returns The correlation ID or undefined if not in a context
	 */
	static getCorrelationId(): string | undefined {
		return this.getStore()?.correlationId
	}

	/**
	 * Get the user ID from the current context
	 * @returns The user ID or undefined
	 */
	static getUserId(): string | undefined {
		return this.getStore()?.userId
	}

	/**
	 * Get the request path from the current context
	 * @returns The request path or undefined
	 */
	static getRequestPath(): string | undefined {
		return this.getStore()?.requestPath
	}

	/**
	 * Get the request method from the current context
	 * @returns The HTTP method or undefined
	 */
	static getMethod(): string | undefined {
		return this.getStore()?.method
	}

	/**
	 * Get the client IP from the current context
	 * @returns The client IP or undefined
	 */
	static getIp(): string | undefined {
		return this.getStore()?.ip
	}

	/**
	 * Get the timestamp when the context was created
	 * @returns The timestamp or undefined
	 */
	static getTimestamp(): number | undefined {
		return this.getStore()?.timestamp
	}

	/**
	 * Get the full request context
	 * @returns The complete RequestContext or undefined
	 */
	static getContext(): RequestContext | undefined {
		return this.getStore()
	}

	/**
	 * Update the context with new values (merge)
	 * @param updates - Partial context to merge
	 */
	static updateContext(updates: Partial<RequestContext>): void {
		const store = this.getStore()
		if (store) {
			Object.assign(store, updates)
		}
	}
}

/**
 * Helper class for correlation ID operations.
 * Provides utilities for extracting, generating, and managing correlation IDs.
 */
export class CorrelationIdHelper {
	/**
	 * Extract or generate a correlation ID from incoming request
	 * @param incomingCorrelationId - The correlation ID from request header
	 * @returns A valid correlation ID (extracted or newly generated)
	 */
	static extractCorrelationId(incomingCorrelationId?: string): string {
		// If valid correlation ID provided, use it
		if (incomingCorrelationId && this.isValidCorrelationId(incomingCorrelationId)) {
			return incomingCorrelationId
		}

		// Otherwise generate a new one
		return this.generateCorrelationId()
	}

	/**
	 * Generate a new correlation ID using UUID v4
	 * @returns A new UUID correlation ID
	 */
	static generateCorrelationId(): string {
		return randomUUID()
	}

	/**
	 * Validate correlation ID format
	 * @param correlationId - The ID to validate
	 * @returns true if valid, false otherwise
	 */
	static isValidCorrelationId(correlationId: string): boolean {
		// Basic validation - not empty and reasonable length
		return (
			typeof correlationId === 'string' &&
			correlationId.length > 0 &&
			correlationId.length <= 100 &&
			!/[\r\n]/.test(correlationId) // No newlines
		)
	}

	/**
	 * Run a callback within a correlation context
	 * @param correlationId - The correlation ID to use
	 * @param metadata - Optional request metadata
	 * @param callback - The callback to run
	 * @returns The result of the callback
	 */
	static runInContext<T>(
		correlationId: string,
		metadata: Partial<Omit<RequestContext, 'correlationId' | 'timestamp'>>,
		callback: () => T,
	): T {
		const context: RequestContext = {
			correlationId,
			timestamp: Date.now(),
			...metadata,
		}

		return AsyncContextStorage.run(context, callback)
	}

	/**
	 * Get the current correlation ID from context
	 * @returns The correlation ID or undefined if not in a context
	 */
	static getCorrelationId(): string | undefined {
		return AsyncContextStorage.getCorrelationId()
	}

	/**
	 * Get the current correlation ID or generate a new one if not in context
	 * @returns A correlation ID (from context or newly generated)
	 */
	static getOrGenerateCorrelationId(): string {
		return this.getCorrelationId() || this.generateCorrelationId()
	}
}