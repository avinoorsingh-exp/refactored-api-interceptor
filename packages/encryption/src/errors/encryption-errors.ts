/**
 * Base error class for all encryption package errors.
 * Consumers can catch this to handle any encryption-related failure.
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Thrown when decryption fails (corrupt ciphertext, wrong key, etc.).
 */
export class DecryptionError extends EncryptionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DecryptionError';
  }
}

/**
 * Thrown when the AAD encryption context on decrypt does not match
 * the context used during encryption. Indicates the ciphertext was
 * moved between records or the wrong context was provided.
 */
export class ContextMismatchError extends DecryptionError {
  constructor(
    public readonly field: string,
    public readonly expected: string,
    public readonly actual: string | undefined,
  ) {
    super(
      `Encryption context mismatch: expected ${field}="${expected}", ` +
        `got ${field}="${actual}". ` +
        'This may indicate the ciphertext was moved between records.',
    );
    this.name = 'ContextMismatchError';
  }
}

/**
 * Thrown when the KMS key is not found or not accessible.
 */
export class KeyNotFoundError extends EncryptionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'KeyNotFoundError';
  }
}

/**
 * Thrown when input to an encryption utility is invalid
 * (e.g., plaintext with no alphanumeric characters for last-4 extraction).
 */
export class InvalidInputError extends EncryptionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'InvalidInputError';
  }
}
