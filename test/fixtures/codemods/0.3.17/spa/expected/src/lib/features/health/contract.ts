import type { components } from '$lib/api/openapi';

export type HealthStatus = components['schemas']['HealthCheckResponse'];

/** What any health API implementation must do. */
export interface HealthApi {
	/** Resolves with the backend's health status; rejects when the request fails. */
	healthStatus(): Promise<HealthStatus>;
}
