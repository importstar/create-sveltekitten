import { createQuery } from '@tanstack/svelte-query';
import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';

export const healthKeys = {
	all: ['health'] as const,
	status: () => [...healthKeys.all, 'status'] as const
};

export const useHealthStatus = (healthApi: HealthApi = defaultHealthApi) => {
	return createQuery(() => ({
		queryKey: healthKeys.status(),
		queryFn: () => healthApi.healthStatus(),
		staleTime: 1000 * 60,
		refetchInterval: 1000 * 60
	}));
};
