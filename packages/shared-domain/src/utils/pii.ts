/**
 * PII utility functions for masking and display.
 * These are pure string utilities with no cryptographic dependencies.
 *
 * @module
 */

/**
 * Detect whether a value is a masked placeholder (e.g., "*****6789").
 * Used to reject masked values on write endpoints — prevents persisting
 * display values as if they were raw tax IDs.
 *
 * Pattern: 5+ mask characters followed by 1-4 visible characters.
 *
 * @param value - The input to check
 * @returns `true` if the value looks like a masked placeholder
 *
 * @example
 * ```typescript
 * isMaskedPlaceholder('*****6789');  // true
 * isMaskedPlaceholder('123-45-6789'); // false
 * isMaskedPlaceholder('');            // false
 * ```
 *
 * @public
 */
export function isMaskedPlaceholder(value: string): boolean {
	return /^\*{5,}.{1,4}$/.test(value);
}

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
 *
 * @public
 */
export function extractLastFour(plaintext: string): string {
	const stripped = plaintext.replace(/[^a-zA-Z0-9]/g, '');

	if (stripped.length === 0) {
		throw new Error(
			'Cannot extract last four: plaintext contains no alphanumeric characters',
		);
	}

	if (stripped.length < 4) {
		return stripped;
	}

	return stripped.slice(-4);
}
