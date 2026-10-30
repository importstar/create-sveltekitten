import createClient from 'openapi-fetch';
import type { paths } from './paths/openapi';

// Define a clear type for the SvelteKit event object for server-side usage.
type ServerEvent = {
	fetch: typeof fetch;
	url: URL;
};

export function createApiClient(event?: ServerEvent) {
	const client = createClient<paths>({
		baseUrl: event ? `${event?.url.origin}/api/proxy` : '/api/proxy',
		fetch: event ? event.fetch : fetch
	});

	return client;
}

const apiClient = createApiClient();

export default apiClient;
