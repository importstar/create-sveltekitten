import createClient from 'openapi-fetch';
import type { paths } from './openapi';
import { PUBLIC_API_URL } from '$env/static/public';

// Define a clear type for the SvelteKit event object for server-side usage.
type ServerEvent = {
	fetch: typeof fetch;
	url: URL;
};

export function createFastApiClient(event?: ServerEvent) {
	const client = createClient<paths>({
		baseUrl: PUBLIC_API_URL
	});

	return client;
}

const client = createFastApiClient();

export default client;

export const apiRequest = async <T>(
	request: Promise<{ data?: T; error?: any; response?: Response }>
) => {
	const { data, error } = await request;

	if (error) {
		throw error;
	}
	return data as T;
};
