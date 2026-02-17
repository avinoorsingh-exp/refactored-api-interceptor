/**
 * Port interface for hashing tax ID values into blind indexes.
 *
 * Used by service layer to generate HMAC-SHA256 tokens for secure lookups
 * without coupling to a specific cryptographic implementation.
 *
 * Concrete implementations:
 * - Production: wraps HmacService from @exprealty/encryption
 * - Test: simple mock returning deterministic values
 *
 * @example Service injection
 * ```typescript
 * @Inject('TaxIdHasher')
 * private readonly hasher: TaxIdHasher
 * ```
 *
 * @example NestJS module wiring
 * ```typescript
 * {
 *   provide: 'TaxIdHasher',
 *   useFactory: () => {
 *     const hmac = new HmacService({ currentSecret: process.env.HMAC_SECRET! });
 *     return { hash: (v) => hmac.generateBlindIndex(v) };
 *   },
 * }
 * ```
 */
export interface TaxIdHasher {
	/**
	 * Compute an HMAC-SHA256 blind index for a plaintext tax ID.
	 *
	 * @param plaintext - Raw tax ID value (e.g., "123-45-6789")
	 * @returns 64-character hex string (HMAC-SHA256)
	 */
	hash(plaintext: string): string;
}
