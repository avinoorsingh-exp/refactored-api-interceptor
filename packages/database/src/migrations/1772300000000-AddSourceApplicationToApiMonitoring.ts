import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `source_application` to `core.api_request_log` (per-request client id from `x-source-app`)
 * and `last_source_application` to `core.api_monitoring_user` (last seen header on profile upsert).
 */
export class AddSourceApplicationToApiMonitoring1772300000000 implements MigrationInterface {
	name = 'AddSourceApplicationToApiMonitoring1772300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE core.api_request_log ADD COLUMN IF NOT EXISTS source_application text NULL
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS idx_api_request_log_source_app
			ON core.api_request_log (source_application, timestamp)
		`);
		await queryRunner.query(`
			ALTER TABLE core.api_monitoring_user ADD COLUMN IF NOT EXISTS last_source_application text NULL
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE core.api_monitoring_user DROP COLUMN IF EXISTS last_source_application`);
		await queryRunner.query(`DROP INDEX IF EXISTS core.idx_api_request_log_source_app`);
		await queryRunner.query(`ALTER TABLE core.api_request_log DROP COLUMN IF EXISTS source_application`);
	}
}
