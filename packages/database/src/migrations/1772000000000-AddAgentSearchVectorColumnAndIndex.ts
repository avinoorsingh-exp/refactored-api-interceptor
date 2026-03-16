import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds a materialized search_vector column to core.agent for full-text search
 * performance. The column is kept up-to-date via trigger on INSERT/UPDATE.
 *
 * - search_vector: tsvector built from first_name, last_name, preferred_name,
 *   middle_name, title, suffix, agent_id (cast to text), system_id (cast to text)
 *   using to_tsvector('simple', ...) for each so tokenization matches plain text.
 * - GIN index on search_vector to accelerate @@ plainto_tsquery('simple', :term).
 *
 * Additive only: does not drop or alter existing columns/indexes.
 * Idempotent: uses IF NOT EXISTS and guard checks.
 */
export class AddAgentSearchVectorColumnAndIndex1772000000000 implements MigrationInterface {
	name = 'AddAgentSearchVectorColumnAndIndex1772000000000'

	private readonly triggerFunctionName = 'core.agent_search_vector_update'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Create the trigger function that sets search_vector from source columns
		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION ${this.triggerFunctionName}()
			RETURNS TRIGGER AS $$
			BEGIN
			  NEW.search_vector :=
			    COALESCE(to_tsvector('simple', COALESCE(NEW.first_name, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.last_name, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.preferred_name, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.middle_name, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.title, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.suffix, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.agent_id::text, '')), '') ||
			    COALESCE(to_tsvector('simple', COALESCE(NEW.system_id::text, '')), '');
			  RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`)

		// 2. Add column if not present
		const hasColumn = await queryRunner.query(`
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'core' AND table_name = 'agent' AND column_name = 'search_vector'
		`)
		if (!hasColumn || hasColumn.length === 0) {
			await queryRunner.query(`
				ALTER TABLE "core"."agent"
				ADD COLUMN IF NOT EXISTS "search_vector" tsvector
			`)
		}

		// 3. Backfill existing rows
		await queryRunner.query(`
			UPDATE "core"."agent" a SET search_vector = (
			  COALESCE(to_tsvector('simple', COALESCE(a.first_name, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.last_name, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.preferred_name, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.middle_name, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.title, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.suffix, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.agent_id::text, '')), '') ||
			  COALESCE(to_tsvector('simple', COALESCE(a.system_id::text, '')), '')
			)
		`)

		// 4. Create trigger (drop first for idempotency)
		await queryRunner.query(`
			DROP TRIGGER IF EXISTS "agent_search_vector_trigger" ON "core"."agent"
		`)
		await queryRunner.query(`
			CREATE TRIGGER "agent_search_vector_trigger"
			BEFORE INSERT OR UPDATE OF first_name, last_name, preferred_name, middle_name, title, suffix, agent_id, system_id
			ON "core"."agent"
			FOR EACH ROW
			EXECUTE PROCEDURE ${this.triggerFunctionName}()
		`)

		// 5. GIN index on search_vector for @@ plainto_tsquery queries
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_agent_search_vector"
			ON "core"."agent" USING GIN ("search_vector")
		`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TRIGGER IF EXISTS "agent_search_vector_trigger" ON "core"."agent"`)
		await queryRunner.query(`DROP FUNCTION IF EXISTS ${this.triggerFunctionName}()`)
		await queryRunner.query(`DROP INDEX IF EXISTS "core"."IDX_agent_search_vector"`)
		await queryRunner.query(`ALTER TABLE "core"."agent" DROP COLUMN IF EXISTS "search_vector"`)
	}
}