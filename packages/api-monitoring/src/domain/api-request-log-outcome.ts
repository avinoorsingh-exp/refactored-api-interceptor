/**
 * Result of attempting to persist one row to `api_request_log`.
 * @public
 */
export type ApiRequestLogSavedOutcome = { status: 'saved' };

export type ApiRequestLogSkippedReason =
	| 'monitoring_disabled'
	| 'no_actor_id'
	| 'sampled'
	| 'interceptor_not_tracked';

export type ApiRequestLogSkippedOutcome = {
	status: 'skipped';
	reason: ApiRequestLogSkippedReason;
	/** Human-readable explanation for operators or clients (also sent as a response header when enabled). */
	message: string;
};

export type ApiRequestLogErrorReason = 'save_failed' | 'unexpected';

export type ApiRequestLogErrorOutcome = {
	status: 'error';
	reason: ApiRequestLogErrorReason;
	message: string;
};

export type ApiRequestLogOutcome =
	| ApiRequestLogSavedOutcome
	| ApiRequestLogSkippedOutcome
	| ApiRequestLogErrorOutcome;

/** Response header: `saved` | `skipped` | `error` */
export const API_MONITORING_REQUEST_LOG_STATUS_HEADER = 'x-api-monitoring-request-log-status';

/** Response header: machine-readable reason when status is not `saved` (kebab-case). */
export const API_MONITORING_REQUEST_LOG_REASON_HEADER = 'x-api-monitoring-request-log-reason';

/** Response header: short human-readable message. */
export const API_MONITORING_REQUEST_LOG_MESSAGE_HEADER = 'x-api-monitoring-request-log-message';
