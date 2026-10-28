import type { components } from '$lib/api/paths/fastapi';

export type HealthStatus = components['schemas']['HealthCheckResponse'];

/** What any health API implementation must do. */
export interface HealthApi {
	/** Resolves with the backend's health status, or `undefined` when it sent no body. */
	healthStatus(): Promise<HealthStatus | undefined>;
}
