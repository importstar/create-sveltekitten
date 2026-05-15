import client, { apiRequest } from '$lib/api/client';
import { createQuery } from '@tanstack/svelte-query';
import { authStore } from '$lib/stores/auth.svelte';

export function useMe() {
	return createQuery(() => ({
		queryKey: ['me'],
		queryFn: () => {
			const headers: Record<string, string> = {};
			if (authStore.accessToken) {
				headers.Authorization = `Bearer ${authStore.accessToken}`;
			}
			return apiRequest(client.GET('/v1/users/me', { headers }));
		}
	}));
}
