import type { Type } from '@nestjs/common';
import type { IApiMonitoringAsyncContext } from '../interfaces/async-context.port.js';
import type { IApiMonitoringLogger } from '../interfaces/logger.interface.js';
import type { ApiMonitoringEntityClasses } from '../tokens/entity-classes.token.js';

/**
 * Options for {@link ApiMonitoringModule.forRoot}.
 * @public
 */
export interface ApiMonitoringForRootOptions {
	/** Logger implementation (class token) implementing {@link IApiMonitoringLogger}. */
	logger: Type<IApiMonitoringLogger>;
	/**
	 * TypeORM entity classes (api request log, route stats, actor).
	 * Omit to use the default entities from this package — each host app still uses its own database
	 * (configure the database connection in your app with `TypeOrmModule` / `DataSource` as usual).
	 * Pass custom classes if you need extended or remapped column metadata while keeping the same table layout.
	 */
	entities?: ApiMonitoringEntityClasses;
	/** Adapter that bridges your async context (e.g. ALS) to API monitoring. */
	asyncContext: Type<IApiMonitoringAsyncContext>;
	/**
	 * When using a named TypeORM connection (`TypeOrmModule.forRoot({ name: '...' })` or multiple DataSources),
	 * set this to the same name so `forFeature` and repository tokens resolve on that connection.
	 * Omit for the default connection.
	 */
	dataSourceName?: string;
}
