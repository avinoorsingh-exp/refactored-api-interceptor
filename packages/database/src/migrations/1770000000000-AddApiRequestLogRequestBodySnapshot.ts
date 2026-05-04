import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds optional request body snapshot column for API monitoring (opt-in via module config).
 */
export class AddApiRequestLogRequestBodySnapshot1770000000000 implements MigrationInterface {
	name = 'AddApiRequestLogRequestBodySnapshot1770000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.addColumn(
			'core.api_request_log',
			new TableColumn({
				name: 'request_body_snapshot',
				type: 'text',
				isNullable: true,
			}),
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.dropColumn('core.api_request_log', 'request_body_snapshot');
	}
}
