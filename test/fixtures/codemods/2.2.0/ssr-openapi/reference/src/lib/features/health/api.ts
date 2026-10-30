import apiClient from '#lib/api/api-client.js';
import type { HealthApi } from './contract';

export const healthStatus = async () => {
	const { data } = await apiClient.GET('/v1/health');
	return data;
};

export const healthApi: HealthApi = { healthStatus };
