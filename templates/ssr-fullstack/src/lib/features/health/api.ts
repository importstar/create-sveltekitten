import type { HealthApi, HealthStatus } from './contract';

export const healthStatus = async (): Promise<HealthStatus | undefined> => {
	const res = await fetch('/api/health');
	return res.ok ? ((await res.json()) as HealthStatus) : undefined;
};

export const healthApi: HealthApi = { healthStatus };
