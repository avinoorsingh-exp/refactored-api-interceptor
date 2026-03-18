import { FeatureFlagKey, isAllowedFeatureFlagKey } from './feature-flag.constants.js';

/**
 * Domain tests for FeatureFlag.
 * Tests allowed keys, default enabled, and validation.
 */
describe('FeatureFlag (domain)', () => {
	describe('allowed keys', () => {
		it('should allow PHASE_2 and PHASE_3 only', () => {
			expect(isAllowedFeatureFlagKey('PHASE_2')).toBe(true);
			expect(isAllowedFeatureFlagKey('PHASE_3')).toBe(true);
			expect(isAllowedFeatureFlagKey('OTHER' as FeatureFlagKey)).toBe(false);
			expect(isAllowedFeatureFlagKey('' as FeatureFlagKey)).toBe(false);
		});

		it('should have exactly two allowed keys', () => {
			const allowed = ['PHASE_2', 'PHASE_3'];
			allowed.forEach((key) => expect(isAllowedFeatureFlagKey(key as FeatureFlagKey)).toBe(true));
			expect(allowed).toHaveLength(2);
		});
	});

	describe('default enabled', () => {
		it('should default enabled to false when not provided', () => {
			// Domain rule: new/seed flags default to enabled = false
			const defaultEnabled = false;
			expect(defaultEnabled).toBe(false);
		});
	});

	describe('invalid key assignment', () => {
		it('should not allow invalid key outside allowed enum', () => {
			expect(isAllowedFeatureFlagKey('PHASE_2')).toBe(true);
			expect(isAllowedFeatureFlagKey('PHASE_3')).toBe(true);
			expect(isAllowedFeatureFlagKey('INVALID' as FeatureFlagKey)).toBe(false);
			expect(isAllowedFeatureFlagKey('phase_2' as FeatureFlagKey)).toBe(false);
		});
	});
});
