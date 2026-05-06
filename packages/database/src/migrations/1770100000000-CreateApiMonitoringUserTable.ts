import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `core.api_monitoring_user` (email + external user id linked to `api_actor`)
 * and adds `monitoring_user_id` to `core.api_request_log`.
 */
export class CreateApiMonitoringUserTable1770100000000 implements MigrationInterface {
	name = 'CreateApiMonitoringUserTable1770100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE core.api_monitoring_user (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				actor_id uuid NOT NULL,
				external_id text NOT NULL,
				user_uuid uuid NULL,
				email text NULL,
				created_at timestamptz NOT NULL DEFAULT now(),
				updated_at timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT uq_api_monitoring_user_external_id UNIQUE (external_id)
			)
		`);
		await queryRunner.query(`
			CREATE INDEX idx_api_monitoring_user_actor ON core.api_monitoring_user (actor_id)
		`);
		await queryRunner.query(`
			ALTER TABLE core.api_request_log ADD COLUMN IF NOT EXISTS monitoring_user_id uuid NULL
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS idx_api_request_log_monitoring_user
			ON core.api_request_log (monitoring_user_id, timestamp)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS core.idx_api_request_log_monitoring_user`);
		await queryRunner.query(`ALTER TABLE core.api_request_log DROP COLUMN IF EXISTS monitoring_user_id`);
		await queryRunner.query(`DROP TABLE IF EXISTS core.api_monitoring_user`);
	}
}
