import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';
import type { Handle } from '@sveltejs/kit';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;
	// ดึง refreshtoken จาก cookies
	if (isProtectedRoute(route.id)) {
		const refreshToken = cookies.get('refreshtoken');
		if (isTokenExpired(refreshToken)) {
			clearCookieTokens(cookies);
		}

		// ถ้าไม่มี refreshtoken ให้ redirect ไปหน้า login
		if (!refreshToken) {
			return new Response(null, {
				status: 303,
				headers: { location: '/login' }
			});
		}
	}
	const response = await resolve(event);
	return response;
};
