import fastapiClient from '$lib/api/fastapi-client';

export const healthStatus = async () => {
	const result = await fastapiClient.GET('/v1/health');
	if (result.error) throw result.error;
	return result.data;
};
