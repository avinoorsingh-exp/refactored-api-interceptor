import { isMaskedPlaceholder, extractLastFour } from '../../src/utils/pii.js';

describe('PII Utilities', () => {
	// =========================================================================
	// isMaskedPlaceholder()
	// =========================================================================

	describe('isMaskedPlaceholder', () => {
		it('should return true for standard masked placeholder *****6789', () => {
			expect(isMaskedPlaceholder('*****6789')).toBe(true);
		});

		it('should return true for extended mask ********89', () => {
			expect(isMaskedPlaceholder('********89')).toBe(true);
		});

		it('should return true for single visible character *****9', () => {
			expect(isMaskedPlaceholder('*****9')).toBe(true);
		});

		it('should return false for empty string', () => {
			expect(isMaskedPlaceholder('')).toBe(false);
		});

		it('should return false for raw SSN 123-45-6789', () => {
			expect(isMaskedPlaceholder('123-45-6789')).toBe(false);
		});

		it('should return false for raw EIN 12-3456789', () => {
			expect(isMaskedPlaceholder('12-3456789')).toBe(false);
		});

		it('should return false for only asterisks *****', () => {
			expect(isMaskedPlaceholder('*****')).toBe(false);
		});

		it('should return false for short mask ***9', () => {
			expect(isMaskedPlaceholder('***9')).toBe(false);
		});

		it('should return false for too many visible chars *****12345', () => {
			expect(isMaskedPlaceholder('*****12345')).toBe(false);
		});
	});

	// =========================================================================
	// extractLastFour()
	// =========================================================================

	describe('extractLastFour', () => {
		it('should extract last 4 digits from SSN 123-45-6789', () => {
			expect(extractLastFour('123-45-6789')).toBe('6789');
		});

		it('should extract last 4 digits from EIN 12-3456789', () => {
			expect(extractLastFour('12-3456789')).toBe('6789');
		});

		it('should extract last 4 characters from alphanumeric ABC123DEF456', () => {
			expect(extractLastFour('ABC123DEF456')).toBe('F456');
		});

		it('should return full value when shorter than 4 alphanumeric chars', () => {
			expect(extractLastFour('AB')).toBe('AB');
		});

		it('should handle padded account number 0012345678', () => {
			expect(extractLastFour('0012345678')).toBe('5678');
		});

		it('should throw when plaintext is empty', () => {
			expect(() => extractLastFour('')).toThrow(
				'Cannot extract last four: plaintext contains no alphanumeric characters',
			);
		});

		it('should throw when plaintext has no alphanumeric characters', () => {
			expect(() => extractLastFour('---')).toThrow(
				'Cannot extract last four: plaintext contains no alphanumeric characters',
			);
		});

		it('should handle value with exactly 4 alphanumeric characters', () => {
			expect(extractLastFour('AB-CD')).toBe('ABCD');
		});
	});
});
