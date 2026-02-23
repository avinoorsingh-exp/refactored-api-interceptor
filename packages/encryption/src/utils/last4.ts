/**
 * Extract the last 4 alphanumeric characters from a plaintext value.
 *
 * Strips all non-alphanumeric characters before extraction.
 * This normalizes across formats:
 * - SSN "123-45-6789"  → "6789"
 * - EIN "12-3456789"   → "6789"
 * - Account "0012345678" → "5678"
 * - ITIN "912-34-5678" → "5678"
 *
 * @param plaintext - The raw value before encryption
 * @returns The last 4 alphanumeric characters, or the full stripped
 *          value if it's shorter than 4 characters
 * @throws {Error} If plaintext is empty or contains no alphanumeric characters
 */
import { InvalidInputError } from '../errors/encryption-errors.js';

export function extractLastFour(plaintext: string): string {
  const stripped = plaintext.replace(/[^a-zA-Z0-9]/g, '');

  if (stripped.length === 0) {
    throw new InvalidInputError(
      'Cannot extract last four: plaintext contains no alphanumeric characters',
    );
  }

  if (stripped.length < 4) {
    return stripped;
  }

  return stripped.slice(-4);
}