import { requireAuth } from '$lib/guards/auth';
import { authStore } from '$lib/stores/auth.svelte';
import type { LayoutLoad } from './$types';

export const load = (async () => {
	console.log('[Guard Layout] Load started');
	console.log('[Guard Layout] Before requireAuth - authStore state:', {
		isAuthenticated: authStore.isAuthenticated,
		hasAccessToken: !!authStore.accessToken,
		// [CapacitorJS] Uncomment for mobile app
		// hasRefreshToken: !!authStore.refreshToken,
		expiresAt: authStore.expiresAt
	});

	await requireAuth();

	console.log('[Guard Layout] After requireAuth - success');
	// Return user data to all child pages
	return {
		user: authStore.user,
		accessToken: authStore.accessToken,
		isAuthenticated: authStore.isAuthenticated
	};
}) satisfies LayoutLoad;
