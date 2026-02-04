/**
 * TypeORM value transformer for encrypted fields.
 * Automatically encrypts on write and decrypts/masks on read.
 *
 * @packageDocumentation
 */

import type { ValueTransformer } from 'typeorm';
import { encrypt, decrypt, mask, isEncrypted } from './encryption.service.js';

/**
 * Configuration for the encrypted column transformer.
 */
export interface EncryptedColumnConfig {
	/**
	 * The encryption key. Typically from environment variable.
	 */
	key: string;

	/**
	 * Whether to mask the value on read instead of fully decrypting.
	 * If true, returns masked value (e.g., "*****6789").
	 * If false, returns fully decrypted value.
	 * Default: false
	 */
	maskOnRead?: boolean;

	/**
	 * Number of characters to show when masking.
	 * Default: 4
	 */
	visibleChars?: number;
}

/**
 * Creates a TypeORM ValueTransformer for encrypted columns.
 *
 * @param config - Encryption configuration
 * @returns ValueTransformer for use with @Column({ transformer: ... })
 *
 * @example
 * ```typescript
 * @Column({
 *   name: 'tax_id',
 *   type: 'text',
 *   transformer: createEncryptedTransformer({
 *     key: process.env.ENCRYPTION_KEY!,
 *     maskOnRead: true,
 *     visibleChars: 4,
 *   }),
 * })
 * taxId?: string;
 * ```
 */
export function createEncryptedTransformer(config: EncryptedColumnConfig): ValueTransformer {
	return {
		/**
		 * Transform value when writing to database.
		 * Encrypts the plaintext value.
		 */
		to(value: string | null | undefined): string | null {
			if (value === null || value === undefined || value === '') {
				return null;
			}

			// Don't re-encrypt if already encrypted
			if (isEncrypted(value)) {
				return value;
			}

			return encrypt(value, { key: config.key });
		},

		/**
		 * Transform value when reading from database.
		 * Decrypts and optionally masks the value.
		 */
		from(value: string | null | undefined): string | null {
			if (value === null || value === undefined || value === '') {
				return null;
			}

			// Check if value is encrypted
			if (!isEncrypted(value)) {
				// Value is not encrypted (legacy data), mask it if required
				return config.maskOnRead ? mask(value, config.visibleChars ?? 4) : value;
			}

			try {
				const decrypted = decrypt(value, { key: config.key });

				if (config.maskOnRead) {
					return mask(decrypted, config.visibleChars ?? 4);
				}

				return decrypted;
			} catch (error) {
				// If decryption fails, return masked version of encrypted string
				// This handles key rotation scenarios gracefully
				console.error('Decryption failed:', error);
				return '****';
			}
		},
	};
}

/**
 * Creates a transformer that only stores encrypted value (never decrypts on read).
 * Useful for fields like password hashes where you never need the original.
 *
 * @param config - Encryption configuration
 * @returns ValueTransformer that encrypts on write, returns encrypted on read
 */
export function createWriteOnlyEncryptedTransformer(config: Pick<EncryptedColumnConfig, 'key'>): ValueTransformer {
	return {
		to(value: string | null | undefined): string | null {
			if (value === null || value === undefined || value === '') {
				return null;
			}

			if (isEncrypted(value)) {
				return value;
			}

			return encrypt(value, { key: config.key });
		},

		from(value: string | null | undefined): string | null {
			// Return encrypted value as-is (never decrypt)
			return value ?? null;
		},
	};
}
