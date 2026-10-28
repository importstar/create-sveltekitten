import fastapiClient from '#lib/api/fastapi-client.js';
import type { HealthApi } from './contract';

export const healthStatus = async () => {
	const { data } = await fastapiClient.GET('/v1/health');
	return data;
};

export const healthApi: HealthApi = { healthStatus };
