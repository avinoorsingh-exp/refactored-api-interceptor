import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add display_name column to api_actor table.
 *
 * Purpose:
 * - Add human-readable display name for UI presentation
 * - Backfill existing records with deterministic display names
 * - Make actor identity human-readable in API responses
 *
 * Display name rules:
 * - USER → email or username from identifier
 * - API_KEY → "API Key: <apiKeyName || apiKeyId>"
 * - SERVICE_ACCOUNT → "Service: <serviceAccountId>"
 * - SYSTEM → "System"
 * - ANONYMOUS → "Anonymous (<short ip hash>)"
 */
export class AddDisplayNameToApiActor1769800000000 implements MigrationInterface {
	name = 'AddDisplayNameToApiActor1769800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Add display_name column (NOT NULL, but we'll backfill first)
		await queryRunner.query(`
			ALTER TABLE "core"."api_actor"
			ADD COLUMN "display_name" TEXT
		`);

		// Backfill display_name for existing records based on type
		// USER: use identifier (email or username)
		await queryRunner.query(`
			UPDATE "core"."api_actor"
			SET "display_name" = COALESCE("identifier", 'User')
			WHERE "type" = 'user'
		`);

		// API_KEY: "API Key: <name || id>"
		await queryRunner.query(`
			UPDATE "core"."api_actor"
			SET "display_name" = 'API Key: ' || COALESCE(
				("metadata"->>'apiKeyName')::text,
				("metadata"->>'apiKeyId')::text,
				"identifier",
				SUBSTRING("id"::text, 1, 8)
			)
			WHERE "type" = 'api_key'
		`);

		// SERVICE_ACCOUNT: "Service: <id>"
		await queryRunner.query(`
			UPDATE "core"."api_actor"
			SET "display_name" = 'Service: ' || COALESCE(
				("metadata"->>'serviceAccountId')::text,
				"identifier",
				SUBSTRING("id"::text, 1, 8)
			)
			WHERE "type" = 'service_account'
		`);

		// SYSTEM: "System"
		await queryRunner.query(`
			UPDATE "core"."api_actor"
			SET "display_name" = 'System'
			WHERE "type" = 'system'
		`);

		// ANONYMOUS: "Anonymous (<ip || short id>)"
		// Extract IP from metadata, or use first 8 chars of UUID as fallback
		await queryRunner.query(`
			UPDATE "core"."api_actor"
			SET "display_name" = 'Anonymous (' || COALESCE(
				("metadata"->>'ip')::text,
				SUBSTRING("id"::text, 1, 8)
			) || ')'
			WHERE "type" = 'anonymous'
		`);

		// Set NOT NULL constraint after backfill
		await queryRunner.query(`
			ALTER TABLE "core"."api_actor"
			ALTER COLUMN "display_name" SET NOT NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove display_name column
		await queryRunner.query(`
			ALTER TABLE "core"."api_actor"
			DROP COLUMN "display_name"
		`);
	}
}

