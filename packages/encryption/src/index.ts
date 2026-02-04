/**
 * @exprealty/encryption
 *
 * Encryption utilities for sensitive data like tax IDs.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @packageDocumentation
 */

export {
	encrypt,
	decrypt,
	mask,
	encryptWithMask,
	isEncrypted,
	type EncryptionConfig,
	type EncryptedData,
} from './encryption.service.js';

export {
	createEncryptedTransformer,
	createWriteOnlyEncryptedTransformer,
	type EncryptedColumnConfig,
} from './transformers.js';
