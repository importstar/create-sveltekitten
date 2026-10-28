import { requireAuth } from '#lib/guards/auth.js';
import { authStore } from '#lib/stores/auth.svelte.js';
import type { LayoutLoad } from './$types';

export const load = (async () => {
	await requireAuth();
	return {
		user: authStore.user,
		accessToken: authStore.accessToken,
		isAuthenticated: authStore.isAuthenticated
	};
}) satisfies LayoutLoad;
