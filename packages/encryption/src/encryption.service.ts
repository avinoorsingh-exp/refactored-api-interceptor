/**
 * Encryption service for sensitive data like tax IDs.
 * Uses AES-256-GCM for encryption with authenticated encryption.
 *
 * @packageDocumentation
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Encryption algorithm used for AES encryption.
 * GCM mode provides authenticated encryption (integrity + confidentiality).
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Length of the initialization vector in bytes.
 * GCM recommends 12 bytes (96 bits) for IV.
 */
const IV_LENGTH = 12;

/**
 * Length of the authentication tag in bytes.
 * GCM uses 16 bytes (128 bits) auth tag.
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Length of the derived key in bytes.
 * AES-256 requires a 32-byte key.
 */
const KEY_LENGTH = 32;

/**
 * Salt length for key derivation.
 */
const SALT_LENGTH = 16;

/**
 * Configuration options for the encryption service.
 */
export interface EncryptionConfig {
	/**
	 * The encryption key or passphrase.
	 * If less than 32 bytes, will be derived using scrypt.
	 */
	key: string;

	/**
	 * Optional salt for key derivation.
	 * If not provided, a random salt is generated per encryption.
	 */
	salt?: string;
}

/**
 * Encrypted data format.
 * Format: salt:iv:authTag:ciphertext (all base64 encoded)
 */
export interface EncryptedData {
	salt: string;
	iv: string;
	authTag: string;
	ciphertext: string;
}

/**
 * Derives a 32-byte key from a passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
	return scryptSync(passphrase, salt, KEY_LENGTH);
}

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * @param plaintext - The text to encrypt
 * @param config - Encryption configuration
 * @returns Encrypted data as a colon-separated base64 string
 *
 * @example
 * ```typescript
 * const encrypted = encrypt('123-45-6789', { key: process.env.ENCRYPTION_KEY });
 * // Returns: "salt:iv:authTag:ciphertext"
 * ```
 */
export function encrypt(plaintext: string, config: EncryptionConfig): string {
	// Generate random salt and IV
	const salt = config.salt
		? Buffer.from(config.salt, 'base64')
		: randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);

	// Derive key from passphrase
	const key = deriveKey(config.key, salt);

	// Create cipher and encrypt
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final(),
	]);

	// Get authentication tag
	const authTag = cipher.getAuthTag();

	// Return as colon-separated base64 string
	return [
		salt.toString('base64'),
		iv.toString('base64'),
		authTag.toString('base64'),
		encrypted.toString('base64'),
	].join(':');
}

/**
 * Decrypts ciphertext that was encrypted with `encrypt()`.
 *
 * @param encryptedString - The encrypted string (salt:iv:authTag:ciphertext)
 * @param config - Encryption configuration (must use same key)
 * @returns The original plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 *
 * @example
 * ```typescript
 * const plaintext = decrypt(encryptedString, { key: process.env.ENCRYPTION_KEY });
 * // Returns: "123-45-6789"
 * ```
 */
export function decrypt(encryptedString: string, config: EncryptionConfig): string {
	const parts = encryptedString.split(':');
	if (parts.length !== 4) {
		throw new Error('Invalid encrypted data format');
	}

	const [saltB64, ivB64, authTagB64, ciphertextB64] = parts;

	const salt = Buffer.from(saltB64, 'base64');
	const iv = Buffer.from(ivB64, 'base64');
	const authTag = Buffer.from(authTagB64, 'base64');
	const ciphertext = Buffer.from(ciphertextB64, 'base64');

	// Derive key from passphrase
	const key = deriveKey(config.key, salt);

	// Create decipher and decrypt
	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return decrypted.toString('utf8');
}

/**
 * Masks a value showing only the last N characters.
 * Useful for displaying sensitive data like SSN or Tax IDs.
 *
 * @param value - The value to mask
 * @param visibleChars - Number of characters to show at the end (default: 4)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked string
 *
 * @example
 * ```typescript
 * mask('123-45-6789', 4); // Returns: "*******6789"
 * mask('123456789', 4);   // Returns: "*****6789"
 * ```
 */
export function mask(value: string, visibleChars = 4, maskChar = '*'): string {
	if (!value || value.length <= visibleChars) {
		return value;
	}

	const masked = maskChar.repeat(value.length - visibleChars);
	const visible = value.slice(-visibleChars);

	return masked + visible;
}

/**
 * Encrypts a value and returns both the encrypted string and a masked version.
 * Convenience function for storing tax IDs where you need both.
 *
 * @param plaintext - The value to encrypt
 * @param config - Encryption configuration
 * @param visibleChars - Number of characters to show in mask (default: 4)
 * @returns Object with encrypted value and masked display value
 *
 * @example
 * ```typescript
 * const { encrypted, masked } = encryptWithMask('123-45-6789', { key });
 * // encrypted: "salt:iv:authTag:ciphertext"
 * // masked: "*******6789"
 * ```
 */
export function encryptWithMask(
	plaintext: string,
	config: EncryptionConfig,
	visibleChars = 4,
): { encrypted: string; masked: string } {
	return {
		encrypted: encrypt(plaintext, config),
		masked: mask(plaintext, visibleChars),
	};
}

/**
 * Check if a string appears to be encrypted (has the expected format).
 *
 * @param value - The value to check
 * @returns True if the value looks like encrypted data
 */
export function isEncrypted(value: string): boolean {
	if (!value) return false;
	const parts = value.split(':');
	return parts.length === 4 && parts.every(p => p.length > 0);
}
