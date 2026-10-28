import type { Handle } from '@sveltejs/kit/hooks';
import { createFastApiClient } from '#lib/api/fastapi-client.js';

export const handleFastApiClient: Handle = async ({ event, resolve }) => {
	// Handle FastAPI requests here
	event.locals.fastapiClient = createFastApiClient(event);

	const response = await resolve(event);
	return response;
};
