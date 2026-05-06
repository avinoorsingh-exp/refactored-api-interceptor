import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `retry_count` to `core.api_request_log` (from `x-retry-count` when replaying failed calls).
 */
export class AddRetryCountToApiRequestLog1772310000000 implements MigrationInterface {
	name = 'AddRetryCountToApiRequestLog1772310000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE core.api_request_log ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE core.api_request_log DROP COLUMN IF EXISTS retry_count`);
	}
}
