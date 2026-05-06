import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces at most one `api_monitoring_user` row per `api_actor` by replacing the non-unique
 * `actor_id` index with a unique index (`uq_api_monitoring_user_actor_id`).
 *
 * **Precondition:** no duplicate `actor_id` values in `core.api_monitoring_user`. Clean duplicates before running.
 */
export class UniqueApiMonitoringUserActorId1772320000000 implements MigrationInterface {
	name = 'UniqueApiMonitoringUserActorId1772320000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS core.idx_api_monitoring_user_actor`);
		await queryRunner.query(`
			CREATE UNIQUE INDEX uq_api_monitoring_user_actor_id ON core.api_monitoring_user (actor_id)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS core.uq_api_monitoring_user_actor_id`);
		await queryRunner.query(`
			CREATE INDEX idx_api_monitoring_user_actor ON core.api_monitoring_user (actor_id)
		`);
	}
}
