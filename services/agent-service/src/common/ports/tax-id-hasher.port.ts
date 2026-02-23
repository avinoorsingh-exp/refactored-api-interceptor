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
 * import { taxIdHasherProvider } from '../../common/providers/tax-id-hasher.provider.js';
 *
 * providers: [taxIdHasherProvider]
 * ```
 */
export interface TaxIdHasher {
	/**
	 * Compute an HMAC-SHA256 blind index for a plaintext tax ID.
	 * Use for all writes — new records and updates.
	 *
	 * @param plaintext - Raw tax ID value (e.g., "123-45-6789")
	 * @returns 64-character hex string (HMAC-SHA256)
	 */
	hash(plaintext: string): string;

	/**
	 * Compute HMAC blind indexes supporting key rotation.
	 * Returns hashes for the current secret and, during a rotation window,
	 * the previous secret. Use with SQL IN for HMAC-based lookups.
	 *
	 * @param plaintext - Raw tax ID value
	 * @returns [currentHash] normally; [currentHash, previousHash] during rotation
	 */
	hashWithFallback(plaintext: string): string[];
}
