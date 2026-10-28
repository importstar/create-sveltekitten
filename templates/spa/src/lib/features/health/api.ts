import client, { apiRequest } from '#lib/api/client.js';
import type { HealthApi } from './contract';

export const healthStatus = () => {
	// ส่ง Promise จาก openapi-fetch เข้า apiRequest ตรงๆ ได้เลย
	return apiRequest(client.GET('/v1/health'));
};

export const healthApi: HealthApi = { healthStatus };
