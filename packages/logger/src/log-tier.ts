/**
 * Log tiering for Datadog forwarding control.
 *
 * Tiers determine whether a log line is indexed in Datadog (costly)
 * or only lands in CloudWatch / archive storage.
 *
 * @public
 */
export enum LogTier {
	/** Always indexed, always alertable. Errors, exceptions, 5xx, PG failures. */
	CRITICAL = 'critical',

	/** Always indexed. Request/response, slow queries, job results, service ready. */
	OPERATIONAL = 'operational',

	/** Archive only. Bootstrap steps, module init, route mapping, cron scheduling. */
	LIFECYCLE = 'lifecycle',

	/** Never indexed. Aggregation SQL, diagnostic queries, verbose debug traces. */
	DEBUG = 'debug',
}

/**
 * Returns true when the log should be forwarded to Datadog for indexing.
 *
 * Maps directly to the `dd.forward` attribute that Datadog pipelines
 * use to decide index vs. archive.
 */
export function shouldForwardLog(tier: LogTier): boolean {
	return tier === LogTier.CRITICAL || tier === LogTier.OPERATIONAL;
}
