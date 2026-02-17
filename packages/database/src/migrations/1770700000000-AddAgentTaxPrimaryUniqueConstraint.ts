import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Migration: Add partial unique index for agent_tax primary constraint.
 *
 * Business rule: Only one tax record per agent can be marked as primary.
 *
 * This follows the same pattern used for contact_method (see
 * AddContactMethodUniqueConstraints1766500000000).
 *
 * Changes:
 * - Adds partial unique index on (agent_id) WHERE is_primary = true
 *   → PostgreSQL error code 23505 on violation
 *   → ProblemDetailsFilter converts to 409 Conflict automatically
 *
 * This migration is idempotent - safe to run multiple times.
 */
export class AddAgentTaxPrimaryUniqueConstraint1770700000000 implements MigrationInterface {
	name = 'AddAgentTaxPrimaryUniqueConstraint1770700000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Partial unique index: only one primary tax per agent
		// Database-level safety net for the business rule
		await queryRunner.query(`
			CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_tax_agent_primary"
			ON "core"."agent_tax" ("agent_id")
			WHERE "is_primary" = true
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP INDEX IF EXISTS "core"."idx_agent_tax_agent_primary"
		`)
	}
}
