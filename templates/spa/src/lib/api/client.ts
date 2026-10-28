import createClient from 'openapi-fetch';
import type { paths } from './openapi';
import { PUBLIC_API_URL } from '$app/env/public';
import { authStore } from '#lib/stores/auth.svelte.js';

export function createFastApiClient() {
	const client = createClient<paths>({
		baseUrl: PUBLIC_API_URL
	});

	return client;
}

const client = createFastApiClient();

client.use({
	async onRequest({ request }) {
		if (authStore.accessToken) {
			request.headers.set(
				'Authorization',
				`${authStore.tokenType ?? 'Bearer'} ${authStore.accessToken}`
			);
		}
		return request;
	}
});

export default client;

export const apiRequest = async <T>(
	request: Promise<{ data?: T; error?: unknown; response?: Response }>
) => {
	const { data, error } = await request;

	if (error) {
		throw error;
	}
	return data as T;
};
