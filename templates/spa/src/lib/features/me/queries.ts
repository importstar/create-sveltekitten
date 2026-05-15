import client, { apiRequest } from '$lib/api/client';
import { createQuery } from '@tanstack/svelte-query';

export function useMe() {
	return createQuery(() => ({
		queryKey: ['me'],
		queryFn: () => {
			return apiRequest(client.GET('/v1/users/me'));
		}
	}));
}
