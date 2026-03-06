/**
 * Allowed feature flag keys. Only these two flags exist.
 */
export const FEATURE_FLAG_KEYS = ['PHASE_2', 'PHASE_3'] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export function isAllowedFeatureFlagKey(key: string): key is FeatureFlagKey {
	return FEATURE_FLAG_KEYS.includes(key as FeatureFlagKey);
}
