import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed initial feature flag rows (PHASE_2, PHASE_3).
 *
 * Purpose:
 * - Insert PHASE_2 and PHASE_3 with enabled = false so Admin UI can toggle them
 *
 * Note: Idempotent - uses ON CONFLICT (key) DO NOTHING.
 */
export class SeedFeatureFlags1771300000001 implements MigrationInterface {
	name = 'SeedFeatureFlags1771300000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`
			INSERT INTO "core"."feature_flags" ("key", "enabled", "created_at", "updated_at")
			VALUES ($1, false, NOW(), NOW())
			ON CONFLICT ("key") DO NOTHING
		`,
			['PHASE_2'],
		);
		await queryRunner.query(
			`
			INSERT INTO "core"."feature_flags" ("key", "enabled", "created_at", "updated_at")
			VALUES ($1, false, NOW(), NOW())
			ON CONFLICT ("key") DO NOTHING
		`,
			['PHASE_3'],
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DELETE FROM "core"."feature_flags"
			WHERE "key" IN ('PHASE_2', 'PHASE_3')
		`);
	}
}
