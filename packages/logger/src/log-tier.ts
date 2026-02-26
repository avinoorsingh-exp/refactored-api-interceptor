/**
 * Log tiering for structured log classification.
 *
 * Tiers classify log importance. Routing decisions (index vs. archive)
 * are handled by Fluent Bit based on tier/channel, not the application.
 *
 * @public
 */
export enum LogTier {
	/** Errors, exceptions, 5xx, PG failures. */
	CRITICAL = 'critical',

	/** Request/response, slow queries, job results, service ready. */
	OPERATIONAL = 'operational',

	/** Bootstrap steps, module init, route mapping, cron scheduling. */
	LIFECYCLE = 'lifecycle',

	/** Aggregation SQL, diagnostic queries, verbose debug traces. */
	DEBUG = 'debug',
}

