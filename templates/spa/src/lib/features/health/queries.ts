// src/lib/features/health/queries.ts (หรือ path ตามที่คุณจัด)
import { createQuery } from '@tanstack/svelte-query';
import { useHealthApi } from './context';
import type { HealthApi } from './contract';

// 1. Query Keys Factory
// กำหนด key ไว้ที่เดียว เพื่อไม่ให้พิมพ์ string เองซ้ำๆ
export const healthKeys = {
	all: ['health'] as const,
	status: () => [...healthKeys.all, 'status'] as const
};

// 2. Custom Hook
export const useHealthStatus = (healthApi: HealthApi = useHealthApi()) => {
	return createQuery(() => ({
		queryKey: healthKeys.status(),
		queryFn: () => healthApi.healthStatus(),
		staleTime: 1000 * 60,
		refetchInterval: 1000 * 60
	}));
};
