import type { Handle } from '@sveltejs/kit';

export const handleTiming: Handle = async ({ event, resolve }) => {
	const start = performance.now();
	const response = await resolve(event);
	response.headers.set('server-timing', `app;dur=${performance.now() - start}`);
	return response;
};
