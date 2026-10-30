import type { Handle } from '@sveltejs/kit/hooks';
import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '#lib/utils/auth.js';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && isTokenExpired(refreshToken)) {
		clearCookieTokens(cookies);
	}

	// A UX guard only: the refresh token is decoded, not verified, because this app holds no
	// signing secret. The API verifies the token on every proxied request, so a forged cookie
	// reaches page shells but no data.
	if (isProtectedRoute(route.id) && !(refreshToken && !isTokenExpired(refreshToken))) {
		return new Response(null, {
			status: 303,
			headers: { location: '/login' }
		});
	}

	const response = await resolve(event);
	return response;
};
