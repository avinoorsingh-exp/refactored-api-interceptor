import { createHmac } from 'crypto';
import type { HmacConfig } from '../config/encryption.config.js';

/**
 * HMAC service for generating deterministic blind indexes.
 *
 * Blind indexes allow exact-match lookups on encrypted columns without
 * decrypting every row. HMAC-SHA256 is one-way — you can't recover
 * the plaintext from the hash, but the same plaintext always produces
 * the same hash (with the same key).
 *
 * IMPORTANT: The HMAC secret is completely separate from the KMS encryption key.
 * Compromising one does not compromise the other.
 *
 * Rotation architecture (Option B, not active by default):
 * - `hash()` always uses `current` — used for writes
 * - `hashWithFallback()` returns hashes for both current and previous secrets
 *   — used for reads during a rotation window
 * - After migration completes, remove `previous` from config
 */
export class HmacService {
  private readonly currentSecret: string;
  private readonly previousSecret: string | undefined;

  constructor(config: HmacConfig) {
    this.currentSecret = config.current;
    this.previousSecret = config.previous;
  }

  /**
   * Generate a blind index hash using the current HMAC secret.
   *
   * Use for all writes — new records and updates.
   *
   * @param plaintext - The sensitive value to hash (e.g., SSN, account number)
   * @returns 64-character hex string (HMAC-SHA256)
   */
  hash(plaintext: string): string {
    return this.computeHmac(plaintext, this.currentSecret);
  }

  /**
   * Generate blind index hashes for lookup, supporting rotation fallback.
   *
   * Returns an array of hashes — one for the current secret, and optionally
   * one for the previous secret if it's configured (rotation window).
   *
   * Use with SQL IN clause:
   * ```sql
   * SELECT * FROM agent_companies
   * WHERE tax_id_hashed IN ($1, $2)
   * ```
   *
   * When no rotation is active, returns a single-element array.
   *
   * @param plaintext - The sensitive value to hash
   * @returns Array of hex strings — [currentHash] or [currentHash, previousHash]
   */
  hashWithFallback(plaintext: string): string[] {
    const hashes = [this.hash(plaintext)];

    if (this.previousSecret) {
      const previousHash = this.computeHmac(plaintext, this.previousSecret);
      // Only add if it's actually different (defensive — always should be)
      if (previousHash !== hashes[0]) {
        hashes.push(previousHash);
      }
    }

    return hashes;
  }

  /**
   * Check if a rotation is currently active (previous secret is configured).
   * Useful for migration tooling.
   */
  isRotationActive(): boolean {
    return this.previousSecret !== undefined;
  }

  /**
   * Compute HMAC-SHA256 of plaintext with a given secret.
   *
   * Normalizes the plaintext before hashing by:
   * 1. Trimming whitespace
   * 2. Converting to lowercase
   *
   * This ensures "123-45-6789" and " 123-45-6789 " produce the same hash.
   * We do NOT strip non-alphanumeric characters — "123456789" and "123-45-6789"
   * should hash differently to avoid collisions across formats.
   */
  private computeHmac(plaintext: string, secret: string): string {
    const normalized = plaintext.trim().toLowerCase();
    return createHmac('sha256', secret).update(normalized).digest('hex');
  }
}