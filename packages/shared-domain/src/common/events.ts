/** Fallback for logs that don't have a typed event yet */
export interface GenericLogData {
  [key: string]: unknown;
}

export interface DbConnectionPoolExhausted {
  database: string;
  poolSize: number;
  waitingCount: number;
}

// ─── Event Map ───────────────────────────────────────────────────────────────
// Maps event string → data payload type.
// This is what gives you compile-time enforcement.

// ─── Database ────────────────────────────────────────────────────────────────

export interface DbQuerySlow {
  /** "timescale", "weaviate", "redis" */
  database: string;
  operation: string;
  durationMs: number;
  /** Slow query threshold that was exceeded */
  thresholdMs: number;
  /** Sanitized query hint — never include parameter values */
  queryHint?: string;
}

export interface EventMap {

    // Database
  'db.query.slow': DbQuerySlow;
  'db.pool.exhausted': DbConnectionPoolExhausted;
    // Freeform fallback
  'log': GenericLogData;
}