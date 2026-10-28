/** What `GET /api/health` returns. */
export type HealthStatus = { status: 'ok' };

/** What any health API implementation must do. */
export interface HealthApi {
	/** Resolves with the app's health status, or `undefined` when it is unhealthy. */
	healthStatus(): Promise<HealthStatus | undefined>;
}
