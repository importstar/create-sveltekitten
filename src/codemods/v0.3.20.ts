import type { Codemod } from './index.js';

const OLD_AUTH_GUARD = `import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/session';
import type { Handle } from '@sveltejs/kit';

export const handleAuthGuard: Handle = async ({ event, resolve }) => {
	const { cookies, route } = event;

	// 1. Check SQLite session token first
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

	// 2. Check FastAPI refresh token
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && isTokenExpired(refreshToken)) {
		clearCookieTokens(cookies);
	}

	// 3. Route Guard for (protected) route group
	if (isProtectedRoute(route.id)) {
		const isAuthenticated = Boolean(
			event.locals.user || (refreshToken && !isTokenExpired(refreshToken))
		);

		if (!isAuthenticated) {
			return new Response(null, {
				status: 303,
				headers: { location: '/login' }
			});
		}
	}

	const response = await resolve(event);
	return response;
};
`;

const NEW_AUTH_GUARD = `import { isProtectedRoute } from '$lib/utils/auth';
import { validateSessionToken, setSessionCookie, deleteSessionCookie } from '$lib/server/auth/session';
import type { Handle } from '@sveltejs/kit';

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
`;

const OLD_PROTECTED_LAYOUT = `import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	if (locals.user) {
		return { user: { username: locals.user.username } };
	}
	const accessToken = cookies.get('access_token');
	const payload = accessToken
		? (jwt.decode(accessToken) as { sub?: string } | null)
		: null;
	return { user: { username: payload?.sub ?? 'User' } };
};
`;

const NEW_PROTECTED_LAYOUT = `import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	return { user: { username: locals.user.username } };
};
`;

const OLD_LOGIN_IMPORT = "import { setAuthTokens, isTokenExpired } from '$lib/utils/auth';";

const NEW_LOGIN_IMPORT = "import { setAuthTokens } from '$lib/utils/auth';";

const OLD_LOGIN_LOAD = `export const load = (async ({ cookies, locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
	const refreshToken = cookies.get('refresh_token');
	if (refreshToken && !isTokenExpired(refreshToken)) {
		throw redirect(303, '/home');
	}
`;

const NEW_LOGIN_LOAD = `export const load = (async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/home');
	}
`;

const normalize = (content: string) => content.replaceAll('\r\n', '\n');

function fixAuthGuard(content: string): string {
	if (normalize(content) === OLD_AUTH_GUARD) return NEW_AUTH_GUARD;
	const unsafeCheck = 'event.locals.user || (refreshToken && !isTokenExpired(refreshToken))';
	if (content.includes(unsafeCheck)) return content.replace(unsafeCheck, 'event.locals.user');
	return content;
}

function fixLogin(content: string): string {
	if (!content.includes(OLD_LOGIN_LOAD) || !content.includes(OLD_LOGIN_IMPORT)) return content;
	return content.replace(OLD_LOGIN_LOAD, NEW_LOGIN_LOAD).replace(OLD_LOGIN_IMPORT, NEW_LOGIN_IMPORT);
}

const codemod: Codemod = {
	from: '0.3.19',
	to: '0.3.20',
	transforms: [
		{
			file: 'src/lib/hooks/auth-guard.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: fixAuthGuard,
		},
		{
			file: 'src/routes/(protected)/+layout.server.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: (content) =>
				normalize(content) === OLD_PROTECTED_LAYOUT ? NEW_PROTECTED_LAYOUT : content,
		},
		{
			file: 'src/routes/login/+page.server.ts',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: fixLogin,
		},
	],
};

export default codemod;
