import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create feature_flags table.
 *
 * Purpose:
 * - Store boolean feature flags (PHASE_2, PHASE_3) editable from Admin UI
 * - Unique constraint on key so only one row per flag
 *
 * Changes:
 * - Creates core.feature_flags table with id, key, enabled, created_at, updated_at
 */
export class CreateFeatureFlagsTable1771300000000 implements MigrationInterface {
	name = 'CreateFeatureFlagsTable1771300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."feature_flags" (
				"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
				"key" text NOT NULL,
				"enabled" boolean NOT NULL DEFAULT false,
				"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
				CONSTRAINT "PK_feature_flags" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_feature_flags_key" UNIQUE ("key")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP TABLE IF EXISTS "core"."feature_flags"
		`);
	}
}
