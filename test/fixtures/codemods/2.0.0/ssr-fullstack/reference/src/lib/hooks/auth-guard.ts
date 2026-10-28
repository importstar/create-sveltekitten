import type { Handle } from '@sveltejs/kit/hooks';
import { isProtectedRoute } from '#lib/utils/auth.js';
import {
	validateSessionToken,
	setSessionCookie,
	deleteSessionCookie
} from '#lib/server/auth/session.js';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

	const sessionId = cookies.get('session_id');
	if (sessionId) {
		const { session, user } = await validateSessionToken(sessionId);
		if (session && user) {
			event.locals.session = session;
			event.locals.user = user;
			setSessionCookie(cookies, sessionId, session.expiresAt);
		} else {
			deleteSessionCookie(cookies);
			event.locals.session = null;
			event.locals.user = null;
		}
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	if (isProtectedRoute(route.id) && !event.locals.user) {
		return new Response(null, {
			status: 303,
			headers: { location: '/login' }
		});
	}

	const response = await resolve(event);
	return response;
};
