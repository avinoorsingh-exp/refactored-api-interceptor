import type { FeatureFlagKey } from '../feature-flag.constants.js';

/**
 * Domain shape for a feature flag (key + enabled only for API).
 * Repository may work with entity; this is the service/API contract.
 */
export interface FeatureFlagRecord {
	id: string;
	key: FeatureFlagKey;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Port for feature flag persistence.
 * No TypeORM leakage; adapter in infrastructure implements this.
 */
export interface IFeatureFlagRepository {
	findAll(): Promise<FeatureFlagRecord[]>;
	findByKey(key: FeatureFlagKey): Promise<FeatureFlagRecord | null>;
	save(flag: FeatureFlagRecord): Promise<FeatureFlagRecord>;
}
