import type { Handle } from '@sveltejs/kit/hooks';
import { createApiClient } from '#lib/api/api-client.js';

export const handleApiClient: Handle = async ({ event, resolve }) => {
	// Attach the API client for this request.
	event.locals.apiClient = createApiClient(event);

	const response = await resolve(event);
	return response;
};
