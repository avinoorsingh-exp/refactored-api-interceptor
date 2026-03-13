import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Enables the pg_prewarm extension for buffer cache management.
 *
 * pg_prewarm allows loading relation and index pages into PostgreSQL's
 * shared_buffers on demand. With autoprewarm enabled (via RDS parameter
 * group: shared_preload_libraries = 'pg_prewarm', pg_prewarm.autoprewarm = on),
 * PostgreSQL periodically saves the buffer contents list and replays it
 * on restart — eliminating cold cache latency after RDS reboots.
 *
 * The extension must be created in the database before pg_prewarm() can
 * be called. Autoprewarm configuration is handled at the RDS parameter
 * group level, not via SQL.
 *
 * RDS Parameter Group settings required for autoprewarm:
 *   shared_preload_libraries: pg_prewarm
 *   pg_prewarm.autoprewarm: on
 */
export class EnablePgPrewarm1772100000000 implements MigrationInterface {
	name = 'EnablePgPrewarm1772100000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_prewarm`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP EXTENSION IF EXISTS pg_prewarm`)
	}
}
